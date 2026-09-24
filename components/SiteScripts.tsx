'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Port of the original single-file site's inline <script> behaviour.
 * Split into:
 *  - a "once" effect for things that live in the persistent layout (nav
 *    dropdowns/mobile menu, cookie consent, scroll-progress bar + glass nav)
 *  - a "per navigation" effect for everything scoped to page content, which
 *    re-runs whenever the route changes (App Router doesn't remount layout).
 *
 * Every effect cleans up after itself (AbortController for listeners,
 * explicit teardown for observers/canvases/rAF) so React Strict Mode's
 * mount->cleanup->mount in dev, and real client-side navigations, don't
 * double-attach handlers or leak canvases.
 */
export default function SiteScripts() {
  const pathname = usePathname();

  // ---------------------------------------------------------------------
  // Persistent (runs once): nav dropdowns/mobile menu, cookie consent,
  // scroll progress bar + glass nav on scroll.
  // ---------------------------------------------------------------------
  useEffect(() => {
    const ac = new AbortController();
    const { signal } = ac;

    // ---- Navigation: dropdowns + mobile menu ----
    const nav = document.querySelector<HTMLElement>('.nav');
    if (nav) {
      const toggles = [...nav.querySelectorAll<HTMLElement>('.menu-toggle')];
      const closeAll = (except?: HTMLElement) =>
        toggles.forEach((t) => {
          if (t !== except) {
            t.setAttribute('aria-expanded', 'false');
            t.parentElement?.classList.remove('open');
          }
        });
      toggles.forEach((t) => {
        t.addEventListener(
          'click',
          (e) => {
            e.stopPropagation();
            const open = t.getAttribute('aria-expanded') !== 'true';
            closeAll(t);
            t.setAttribute('aria-expanded', String(open));
            t.parentElement?.classList.toggle('open', open);
          },
          { signal }
        );
      });
      document.addEventListener(
        'click',
        (e) => {
          if (!nav.contains(e.target as Node)) closeAll();
        },
        { signal }
      );
      document.addEventListener(
        'keydown',
        (e) => {
          if (e.key === 'Escape') {
            closeAll();
            nav.classList.remove('mobile-open');
            const b = nav.querySelector<HTMLElement>('.burger');
            if (b) b.setAttribute('aria-expanded', 'false');
          }
        },
        { signal }
      );
      const burger = nav.querySelector<HTMLElement>('.burger');
      if (burger) {
        burger.addEventListener(
          'click',
          () => {
            const o = !nav.classList.contains('mobile-open');
            nav.classList.toggle('mobile-open', o);
            burger.setAttribute('aria-expanded', String(o));
          },
          { signal }
        );
      }
    }

    // ---- Cookie consent + analytics ----
    // Put your Google Analytics 4 ID here. Analytics loads only after accept.
    const GA_ID = '';
    const store = {
      get(): string | null {
        try {
          return localStorage.getItem('csl-consent');
        } catch {
          return null;
        }
      },
      set(v: string) {
        try {
          localStorage.setItem('csl-consent', v);
        } catch {
          /* ignore */
        }
      },
    };
    const loadGA = () => {
      if (!GA_ID || (window as any).gtag) return;
      const sc = document.createElement('script');
      sc.async = true;
      sc.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
      document.head.appendChild(sc);
      (window as any).dataLayer = (window as any).dataLayer || [];
      (window as any).gtag = function gtag() {
        (window as any).dataLayer.push(arguments);
      };
      (window as any).gtag('js', new Date());
      (window as any).gtag('config', GA_ID, { anonymize_ip: true });
    };
    const banner = document.getElementById('consent');
    const choice = store.get();
    if (choice === 'accept') loadGA();
    if (banner && !choice) {
      (banner as HTMLElement).hidden = false;
      banner.querySelector('[data-consent="accept"]')?.addEventListener(
        'click',
        () => {
          store.set('accept');
          (banner as HTMLElement).hidden = true;
          loadGA();
        },
        { signal }
      );
      banner.querySelector('[data-consent="reject"]')?.addEventListener(
        'click',
        () => {
          store.set('reject');
          (banner as HTMLElement).hidden = true;
        },
        { signal }
      );
    }

    // ---- Scroll progress + glass nav ----
    const root = document.documentElement;
    root.classList.add('motion');
    const bar = document.createElement('div');
    bar.className = 'scroll-prog';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    const onScroll = () => {
      const h = root.scrollHeight - root.clientHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? root.scrollTop / h : 0) + ')';
      if (nav) nav.classList.toggle('nav-glass', scrollY > 8);
    };
    addEventListener('scroll', onScroll, { passive: true, signal });
    onScroll();

    return () => {
      ac.abort();
      bar.remove();
    };
  }, []);

  // ---------------------------------------------------------------------
  // Per navigation: everything scoped to whatever page content is current.
  // ---------------------------------------------------------------------
  useEffect(() => {
    const ac = new AbortController();
    const { signal } = ac;
    const cleanups: Array<() => void> = [];
    const RM =
      typeof window.matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---- reCAPTCHA (contact/enquiry/newsletter forms) ----
    const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (RECAPTCHA_SITE_KEY) {
      document
        .querySelectorAll<HTMLFormElement>('#enquiry, .multi-form, .news-form')
        .forEach((form) => {
          const existing = form.querySelector<HTMLElement>('.g-recaptcha');
          if (existing) existing.remove();
          const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
          if (!submitBtn?.parentElement) return;
          const container = document.createElement('div');
          container.className = 'g-recaptcha';
          container.style.margin = '4px 0 14px';
          submitBtn.parentElement.insertBefore(container, submitBtn);

          let cancelled = false;
          const tryRender = () => {
            if (cancelled || !container.isConnected) return;
            const g = (window as any).grecaptcha;
            if (g && typeof g.render === 'function') {
              try {
                const widgetId = g.render(container, { sitekey: RECAPTCHA_SITE_KEY });
                (form as any)._recaptchaWidgetId = widgetId;
              } catch {
                setTimeout(tryRender, 250);
              }
            } else {
              setTimeout(tryRender, 250);
            }
          };
          tryRender();
          cleanups.push(() => {
            cancelled = true;
            container.remove();
          });
        });
    }
    const recaptchaTokenFor = (form: HTMLFormElement): string | null => {
      if (!RECAPTCHA_SITE_KEY) return '';
      const widgetId = (form as any)._recaptchaWidgetId;
      const g = (window as any).grecaptcha;
      if (widgetId === undefined || !g || typeof g.getResponse !== 'function') return '';
      const token = g.getResponse(widgetId);
      return token ? token : null;
    };

    // ---- Generative duotone "micrographs" ----
    function rng(seed: number) {
      return function () {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
    }
    function hex(h: string) {
      h = h.replace('#', '');
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    function field(type: string, W: number, H: number, r: () => number) {
      const f = new Float32Array(W * H);
      if (type === 'cells') {
        const pts: [number, number][] = [];
        for (let i = 0; i < 70; i++) pts.push([r() * W, r() * H]);
        for (let y = 0; y < H; y++)
          for (let x = 0; x < W; x++) {
            let d1 = 1e9,
              d2 = 1e9;
            for (const p of pts) {
              const dx = p[0] - x,
                dy = p[1] - y,
                d = dx * dx + dy * dy;
              if (d < d1) {
                d2 = d1;
                d1 = d;
              } else if (d < d2) d2 = d;
            }
            const e = Math.sqrt(d2) - Math.sqrt(d1);
            let v = Math.min(1, e / 7);
            v = 0.25 + 0.6 * v + 0.15 * Math.sin(Math.sqrt(d1) * 0.35);
            f[y * W + x] = v;
          }
      } else if (type === 'droplets') {
        for (let i = 0; i < W * H; i++) f[i] = 0.12;
        for (let i = 0; i < 120; i++) {
          const cx = r() * W,
            cy = r() * H,
            rad = 4 + Math.pow(r(), 2.2) * 34;
          for (let y = Math.max(0, (cy - rad) | 0); y < Math.min(H, cy + rad + 1); y++)
            for (let x = Math.max(0, (cx - rad) | 0); x < Math.min(W, cx + rad + 1); x++) {
              const d = Math.hypot(x - cx, y - cy) / rad;
              if (d < 1) {
                const rim = Math.pow(d, 6) * 0.8,
                  hl =
                    Math.max(0, 1 - Math.hypot(x - (cx - rad * 0.35), y - (cy - rad * 0.35)) / (rad * 0.45)) * 0.6;
                f[y * W + x] = Math.max(f[y * W + x], 0.3 + rim + hl);
              }
            }
        }
      } else {
        for (let i = 0; i < W * H; i++) f[i] = 0.1;
        for (let i = 0; i < 90; i++) {
          const cx = r() * W,
            cy = r() * H,
            a = r() * Math.PI,
            len = 10 + r() * 16,
            w = 3.2 + r() * 2;
          const ca = Math.cos(a),
            sa = Math.sin(a);
          for (let y = Math.max(0, (cy - len - w) | 0); y < Math.min(H, cy + len + w + 1); y++)
            for (let x = Math.max(0, (cx - len - w) | 0); x < Math.min(W, cx + len + w + 1); x++) {
              const dx = x - cx,
                dy = y - cy,
                u = dx * ca + dy * sa,
                v = -dx * sa + dy * ca;
              const uu = Math.max(0, Math.abs(u) - len / 2);
              const d = Math.hypot(uu, v) / w;
              if (d < 1) {
                f[y * W + x] = Math.max(f[y * W + x], 0.35 + 0.65 * (1 - d * d));
              }
            }
        }
      }
      for (let i = 0; i < W * H; i++) f[i] = Math.min(1, Math.max(0, f[i] + (r() - 0.5) * 0.08));
      return f;
    }
    function paintMicro(cv: HTMLCanvasElement, seed: number) {
      const W = 260,
        H = 260,
        r = rng(seed),
        type = cv.dataset.micro || '',
        dk = hex(cv.dataset.dark || '#000000'),
        lt = hex(cv.dataset.light || '#ffffff');
      const f = field(type, W, H, r),
        off = document.createElement('canvas');
      off.width = W;
      off.height = H;
      const ctx = off.getContext('2d')!,
        img = ctx.createImageData(W, H);
      for (let i = 0; i < W * H; i++) {
        const t = f[i];
        for (let c = 0; c < 3; c++) img.data[i * 4 + c] = dk[c] + (lt[c] - dk[c]) * t;
        img.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      const draw = () => {
        const b = cv.getBoundingClientRect(),
          dpr = Math.min(2, window.devicePixelRatio || 1);
        cv.width = Math.max(1, b.width * dpr);
        cv.height = Math.max(1, b.height * dpr);
        const g = cv.getContext('2d')!;
        g.imageSmoothingQuality = 'high';
        const s = Math.max(cv.width / W, cv.height / H);
        g.drawImage(off, (cv.width - W * s) / 2, (cv.height - H * s) / 2, W * s, H * s);
      };
      draw();
      const ro = new ResizeObserver(draw);
      ro.observe(cv);
      cleanups.push(() => ro.disconnect());
    }
    document.querySelectorAll<HTMLCanvasElement>('canvas[data-micro]').forEach((c, i) => paintMicro(c, 17 + i * 101));

    // ---- Test catalogue tabs ----
    document.querySelectorAll<HTMLElement>('.tabs').forEach((tabs) => {
      const wrap = tabs.parentElement;
      if (!wrap) return;
      const btns = [...tabs.querySelectorAll<HTMLElement>('.tab')];
      const set = (k: string | undefined) => {
        btns.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.k === k)));
        wrap.querySelectorAll<HTMLElement>('[data-tab]').forEach((p) => (p.hidden = p.dataset.tab !== k));
      };
      btns.forEach((t) => t.addEventListener('click', () => set(t.dataset.k), { signal }));
    });

    // ---- Claim finder ----
    const claimList = document.getElementById('claimList');
    if (claimList) {
      const btns = [...claimList.querySelectorAll<HTMLElement>('.claim')];
      const plans = [...document.querySelectorAll<HTMLElement>('#plan [data-plan]')];
      const show = (i: number) => {
        btns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
        plans.forEach((p, j) => (p.hidden = j !== i));
      };
      btns.forEach((b, i) => b.addEventListener('click', () => show(i), { signal }));
    }

    // ---- Enquiry form ----
    const enquiry = document.getElementById('enquiry') as HTMLFormElement | null;
    const enquiryOk = document.getElementById('formOk') as HTMLElement | null;
    if (enquiry && enquiryOk) {
      enquiry.addEventListener(
        'submit',
        (e) => {
          e.preventDefault();
          const honeypot = enquiry.querySelector<HTMLInputElement>('[name="website"]');
          if (honeypot && honeypot.value) return;
          const req = [...enquiry.querySelectorAll<HTMLInputElement>('[required]')];
          let bad: HTMLInputElement | null = null;
          req.forEach((el) => {
            const okv = !!el.value.trim() && (el.type !== 'email' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value));
            el.classList.toggle('invalid', !okv);
            el.setAttribute('aria-invalid', String(!okv));
            if (!okv && !bad) bad = el;
          });
          enquiryOk.hidden = false;
          if (bad) {
            enquiryOk.textContent = 'Please complete the highlighted fields so we can reply.';
            (bad as HTMLInputElement).focus();
            return;
          }
          if (recaptchaTokenFor(enquiry) === null) {
            enquiryOk.textContent = 'Please confirm the reCAPTCHA checkbox.';
            return;
          }
          const endpoint = enquiry.dataset.endpoint || '/api/contact';
          enquiryOk.textContent = 'Sending…';
          fetch(endpoint, { method: 'POST', body: new FormData(enquiry) })
            .then((r) => {
              if (!r.ok) throw 0;
              location.href = '/thank-you';
            })
            .catch(() => {
              enquiryOk.textContent = 'Your enquiry could not be sent. Please try again, or message us on WhatsApp.';
            });
        },
        { signal }
      );
    }

    // ---- Testimonial carousel ----
    document.querySelectorAll<HTMLElement>('.t-card').forEach((card) => {
      const slides = [...card.querySelectorAll<HTMLElement>('.t-slide')];
      if (slides.length < 2) return;
      let i = 0;
      const show = (n: number) => {
        i = (n + slides.length) % slides.length;
        slides.forEach((s, k) => (s.hidden = k !== i));
      };
      card.querySelector('.t-prev')?.addEventListener('click', () => show(i - 1), { signal });
      card.querySelector('.t-next')?.addEventListener('click', () => show(i + 1), { signal });
    });

    // ---- Launch timeline calculator ----
    const tc = document.getElementById('timelineCalc');
    if (tc) {
      const boxes = [...tc.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
      const extra = tc.querySelector<HTMLInputElement>('#tc-markets');
      const out = tc.querySelector<HTMLElement>('#tc-total');
      if (extra && out) {
        const calc = () => {
          const v = boxes.map((b) => (b.checked ? [+(b.dataset.min || 0), +(b.dataset.max || 0)] : [0, 0]));
          const lo = v[0][0] + Math.max(v[1][0], v[2][0]) + Math.max(v[3][0], v[4][0]);
          const hi = v[0][1] + Math.max(v[1][1], v[2][1]) + Math.max(v[3][1], v[4][1]);
          const n = Math.max(0, Math.min(10, +extra.value || 0));
          out.textContent = lo + n + '–' + (hi + 2 * n) + ' weeks';
        };
        boxes.forEach((b) => b.addEventListener('change', calc, { signal }));
        extra.addEventListener('input', calc, { signal });
        calc();
      }
    }

    // ---- Newsletter sign-up ----
    document.querySelectorAll<HTMLFormElement>('.news-form').forEach((nf) => {
      nf.addEventListener(
        'submit',
        (e) => {
          e.preventDefault();
          const em = nf.querySelector<HTMLInputElement>('input[type=email]');
          const msg = nf.querySelector<HTMLElement>('.small');
          if (!em || !msg) return;
          msg.hidden = false;
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em.value)) {
            em.classList.add('invalid');
            msg.textContent = 'Enter a valid business email.';
            em.focus();
            return;
          }
          em.classList.remove('invalid');
          if (recaptchaTokenFor(nf) === null) {
            msg.textContent = 'Please confirm the reCAPTCHA checkbox.';
            return;
          }
          fetch(nf.dataset.endpoint || '/api/contact', { method: 'POST', body: new FormData(nf) })
            .then(() => {
              msg.textContent = 'Subscribed. Check your inbox to confirm.';
            })
            .catch(() => {
              msg.textContent = 'Could not subscribe. Please try again.';
            });
        },
        { signal }
      );
    });

    // ---- Facility tabs ----
    document.querySelectorAll<HTMLElement>('.fac').forEach((sec) => {
      const tabs = [...sec.querySelectorAll<HTMLElement>('.fac-tab')];
      const panels = [...sec.querySelectorAll<HTMLElement>('.fac-panel')];
      const show = (i: number) => {
        tabs.forEach((t, j) => t.setAttribute('aria-selected', String(j === i)));
        panels.forEach((p, j) => (p.hidden = j !== i));
      };
      tabs.forEach((t, i) => {
        t.addEventListener('click', () => show(i), { signal });
        t.addEventListener(
          'keydown',
          (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault();
              const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
              show(n);
              tabs[n].focus();
            }
          },
          { signal }
        );
      });
    });

    // ---- Insights filters (sector, application, market) ----
    const fb = document.getElementById('insFilters');
    if (fb && fb.parentElement) {
      const grid = fb.parentElement.querySelector<HTMLElement>('.ins-grid');
      const cards = grid ? [...grid.querySelectorAll<HTMLElement>('.ins-card')] : [];
      const sels = [...fb.querySelectorAll<HTMLSelectElement>('select')];
      const count = document.getElementById('insCount');
      const empty = document.getElementById('insEmpty');
      let cat = '';
      const pills = [...document.querySelectorAll<HTMLElement>('#catPills .cat-pill')];
      const apply = () => {
        let n = 0;
        cards.forEach((c) => {
          const ok =
            (!cat || c.dataset.cat === cat) &&
            sels.every((s) => !s.value || (c.dataset[s.dataset.key as string] || '').split(' ').includes(s.value));
          c.hidden = !ok;
          if (ok) n++;
        });
        if (count) count.textContent = n + (n === 1 ? ' article' : ' articles');
        if (empty) empty.hidden = n > 0;
        pills.forEach((p) => {
          const on = p.dataset.cat === cat;
          p.classList.toggle('on', on);
          p.setAttribute('aria-selected', String(on));
        });
      };
      const setCat = (c: string, scroll?: boolean) => {
        cat = c || '';
        apply();
        if (scroll) {
          const t = document.getElementById('catPills');
          if (t) setTimeout(() => scrollTo(0, t.getBoundingClientRect().top + scrollY - 100), 30);
        }
      };
      pills.forEach((p) => p.addEventListener('click', () => setCat(p.dataset.cat || ''), { signal }));
      document.querySelectorAll<HTMLElement>('.cat-card').forEach((b) =>
        b.addEventListener('click', () => setCat(b.dataset.cat || '', true), { signal })
      );
      sels.forEach((s) => s.addEventListener('change', apply, { signal }));
      document.getElementById('flt-reset')?.addEventListener(
        'click',
        () => {
          sels.forEach((s) => (s.value = ''));
          setCat('', false);
        },
        { signal }
      );
      const fromHash = (h: string) => {
        const m = /cat-([\w-]+)/.exec(h || '');
        if (m) setCat(m[1], true);
      };
      fromHash(location.hash);
    }

    // ---- Copy article link ----
    document.querySelectorAll<HTMLElement>('.copy-link').forEach((b) =>
      b.addEventListener(
        'click',
        () => {
          const done = () => {
            b.textContent = 'Link copied';
            setTimeout(() => (b.textContent = 'Copy link'), 2000);
          };
          const url = b.dataset.url || '';
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard
              .writeText(url)
              .then(done)
              .catch(() => {
                b.textContent = url;
              });
          } else {
            b.textContent = url;
          }
        },
        { signal }
      )
    );

    // ---- Careers application ----
    const cf = document.getElementById('careerForm') as HTMLFormElement | null;
    if (cf) {
      cf.addEventListener(
        'submit',
        (e) => {
          e.preventDefault();
          const ok = document.getElementById('careerOk') as HTMLElement;
          ok.hidden = false;
          const hp = cf.querySelector<HTMLInputElement>('[name="website"]');
          if (hp && hp.value) return;
          let bad: HTMLElement | null = null;
          cf.querySelectorAll<HTMLInputElement>('[required]').forEach((el) => {
            if (el.closest('[hidden]')) return;
            let v: boolean =
              el.type === 'checkbox' ? el.checked : el.type === 'file' ? (el.files?.length ?? 0) > 0 : !!el.value.trim();
            if (v && el.type === 'email') v = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value);
            if (v && el.type === 'file') {
              const f = el.files?.[0];
              v = !!f && f.size <= 5 * 1024 * 1024 && /\.(pdf|docx?)$/i.test(f.name);
            }
            el.classList.toggle('invalid', !v);
            el.setAttribute('aria-invalid', String(!v));
            if (!v && !bad) bad = el;
          });
          if (bad) {
            const b = bad as HTMLInputElement;
            ok.textContent =
              b.type === 'file' && b.files && b.files.length
                ? 'Please attach your CV as a PDF or Word file under 5 MB.'
                : 'Please complete the highlighted fields.';
            b.focus();
            return;
          }
          if (cf.dataset.endpoint) {
            ok.textContent = 'Sending…';
            fetch(cf.dataset.endpoint, { method: 'POST', body: new FormData(cf) })
              .then((r) => {
                if (!r.ok) throw 0;
                ok.textContent = 'Thank you. Your application has been sent to careers@guires.com. We will be in touch if your profile matches a role.';
                cf.reset();
              })
              .catch(() => {
                ok.textContent = 'Your application could not be sent. Please email your CV to careers@guires.com.';
              });
            return;
          }
          const firstEl = cf.querySelector<HTMLInputElement>('#c-first');
          ok.textContent = 'Thanks, ' + (firstEl?.value.trim() || '') + '. This is a design preview. On the live site your application goes to careers@guires.com.';
        },
        { signal }
      );
    }
    document.querySelectorAll<HTMLElement>('.copy-mail').forEach((b) =>
      b.addEventListener(
        'click',
        () => {
          const m = b.dataset.mail || '';
          const done = () => {
            b.textContent = 'Copied';
            setTimeout(() => (b.textContent = 'Copy'), 2000);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(m).then(done).catch(() => {});
        },
        { signal }
      )
    );

    // ---- Contact: switch between New business / Supplier / Partnership forms ----
    document.querySelectorAll<HTMLElement>('.etype-switch').forEach((sw) => {
      const btns = [...sw.querySelectorAll<HTMLElement>('button')];
      const show = (id: string | undefined) => {
        btns.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.form === id)));
        btns.forEach((b) => {
          const f = document.getElementById(b.dataset.form || '');
          if (f) (f as HTMLElement).hidden = b.dataset.form !== id;
        });
      };
      btns.forEach((b) => b.addEventListener('click', () => show(b.dataset.form), { signal }));
    });

    // ---- Generic validation + submit for supplier / partnership forms ----
    const validate = (form: HTMLFormElement) => {
      let bad: HTMLElement | null = null;
      form.querySelectorAll<HTMLInputElement>('[required]').forEach((el) => {
        if (el.closest('[hidden]')) return;
        let v: boolean = el.type === 'checkbox' ? el.checked : el.type === 'file' ? (el.files?.length ?? 0) > 0 : !!el.value.trim();
        if (v && el.type === 'email') v = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value);
        el.classList.toggle('invalid', !v);
        el.setAttribute('aria-invalid', String(!v));
        if (!v && !bad) bad = el;
      });
      form.querySelectorAll<HTMLInputElement>('input[type=file]').forEach((el) => {
        const f = el.files?.[0];
        if (f && f.size > 10 * 1024 * 1024) {
          el.classList.add('invalid');
          if (!bad) bad = el;
        }
      });
      return bad;
    };
    document.querySelectorAll<HTMLFormElement>('.multi-form').forEach((form) =>
      form.addEventListener(
        'submit',
        (e) => {
          e.preventDefault();
          const ok = form.querySelector<HTMLElement>('.form-ok');
          if (!ok) return;
          ok.hidden = false;
          const hp = form.querySelector<HTMLInputElement>('[name="website_hp"]');
          if (hp && hp.value) return;
          const bad = validate(form);
          if (bad) {
            ok.textContent = 'Please complete the highlighted fields.';
            (bad as HTMLElement).focus();
            return;
          }
          if (recaptchaTokenFor(form) === null) {
            ok.textContent = 'Please confirm the reCAPTCHA checkbox.';
            return;
          }
          ok.textContent = 'Sending…';
          fetch(form.dataset.endpoint || '/api/contact', { method: 'POST', body: new FormData(form) })
            .then((r) => {
              if (!r.ok) throw 0;
              location.href = '/thank-you';
            })
            .catch(() => {
              ok.textContent = 'Could not send. Please email info@cosmeticsciencelab.com.';
            });
        },
        { signal }
      )
    );

    // ---- Careers: job vs internship ----
    const at = document.querySelector<HTMLElement>('.app-type');
    if (at) {
      const intern = document.querySelector<HTMLElement>('.intern-only');
      const role = document.getElementById('c-role') as HTMLInputElement | null;
      const notice = document.getElementById('c-notice');
      if (intern && role && notice) {
        const jobBits = [role.closest<HTMLElement>('.f2'), notice.closest<HTMLElement>('.field')];
        const set = () => {
          const checked = at.querySelector<HTMLInputElement>('input:checked');
          const isI = checked?.value === 'Internship';
          intern.hidden = !isI;
          jobBits.forEach((x) => {
            if (x) x.hidden = isI;
          });
          intern.querySelectorAll<HTMLInputElement>('[data-req-intern]').forEach((el) => (el.required = isI));
          role.required = !isI;
        };
        at.querySelectorAll<HTMLInputElement>('input').forEach((i) => i.addEventListener('change', set, { signal }));
        set();
      }
    }

    // ------------------------------------------------------------------
    // MOTION LAYER
    // ------------------------------------------------------------------

    // ---- scroll reveal with stagger ----
    const SEL =
      '.block .head,.two-col > .sticky,.rows > div,.deliver > div,.ev-card,.mk-svc,.pkg,.concept,.pillar,.signal,.tq,.sec-card,.values > div,.tm,.tl li,.kw-intro p,.entry article,.founder,.story,.ai-card,.faq details,.related a,.moments li,.recv li,.needs li,.group-photo,.loc-map,.steps li,.art-card,.ins-grid > *,.cats span,.cat-card';
    const els = [...document.querySelectorAll<HTMLElement>(SEL)];
    els.forEach((el) => {
      el.classList.add('rv');
      const sib = el.parentNode ? [...el.parentNode.children].indexOf(el) : 0;
      el.style.setProperty('--d', Math.min(sib, 8) * 70 + 'ms');
    });
    if (RM || !('IntersectionObserver' in window)) {
      els.forEach((e) => e.classList.add('in'));
    } else {
      const io = new IntersectionObserver(
        (en) => {
          en.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('in');
              io.unobserve(e.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
      );
      els.forEach((e) => io.observe(e));
      cleanups.push(() => io.disconnect());
    }

    // ---- count-up numbers ----
    const nums = [...document.querySelectorAll<HTMLElement>('.stat strong:not(.txt),.founder-stats strong,.story-badge b')];
    function countUp(el: HTMLElement) {
      const m = /^(\d+)(.*)$/.exec(el.textContent?.trim() || '');
      if (!m || RM) return;
      const end = +m[1],
        suf = m[2],
        dur = 1400;
      let t0: number | null = null;
      let raf = 0;
      function step(t: number) {
        if (!t0) t0 = t;
        const p = Math.min((t - t0) / dur, 1),
          e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(end * e) + suf;
        if (p < 1) raf = requestAnimationFrame(step);
      }
      raf = requestAnimationFrame(step);
      cleanups.push(() => cancelAnimationFrame(raf));
    }
    if ('IntersectionObserver' in window) {
      const io2 = new IntersectionObserver(
        (en) => {
          en.forEach((e) => {
            if (e.isIntersecting) {
              countUp(e.target as HTMLElement);
              io2.unobserve(e.target);
            }
          });
        },
        { threshold: 0.6 }
      );
      nums.forEach((n) => io2.observe(n));
      cleanups.push(() => io2.disconnect());
    }

    // ---- neural-network canvas behind heroes and dark bands ----
    const hosts = [...document.querySelectorAll<HTMLElement>('.page-hero,.banner,.visit-band,.callout,.ai-sec,.contact-card')];
    hosts.forEach((host) => {
      const dark =
        host.classList.contains('banner') ||
        host.classList.contains('visit-band') ||
        host.classList.contains('callout') ||
        host.classList.contains('ai-sec') ||
        host.classList.contains('contact-card');
      const cv = document.createElement('canvas');
      cv.className = 'neural';
      cv.setAttribute('aria-hidden', 'true');
      host.insertBefore(cv, host.firstChild);
      cleanups.push(() => cv.remove());

      const ctx = cv.getContext('2d')!;
      let W = 0,
        H = 0;
      let pts: { x: number; y: number; vx: number; vy: number; r: number; p: number }[] = [];
      const mouse = { x: -9999, y: -9999 };
      let run = false;
      let raf = 0;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const col = dark ? '217,166,255' : '161,0,255';

      function size() {
        const r = host.getBoundingClientRect();
        W = r.width;
        H = r.height;
        if (!W || !H) return;
        cv.width = W * dpr;
        cv.height = H * dpr;
        cv.style.width = W + 'px';
        cv.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const n = Math.round(Math.min(90, Math.max(24, (W * H) / 16000)));
        pts = [];
        for (let i = 0; i < n; i++)
          pts.push({
            x: Math.random() * W,
            y: Math.random() * H,
            vx: (Math.random() - 0.5) * 0.35,
            vy: (Math.random() - 0.5) * 0.35,
            r: 1 + Math.random() * 1.8,
            p: Math.random() * 6.28,
          });
      }
      function frame() {
        ctx.clearRect(0, 0, W, H);
        const L = Math.min(150, W / 7);
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i];
          a.x += a.vx;
          a.y += a.vy;
          if (a.x < 0 || a.x > W) a.vx *= -1;
          if (a.y < 0 || a.y > H) a.vy *= -1;
          a.p += 0.03;
          const dx = mouse.x - a.x,
            dy = mouse.y - a.y,
            dm = Math.sqrt(dx * dx + dy * dy);
          if (dm < 160) {
            a.x += dx * 0.004;
            a.y += dy * 0.004;
          }
          for (let j = i + 1; j < pts.length; j++) {
            const b = pts[j],
              x = a.x - b.x,
              y = a.y - b.y,
              d = Math.sqrt(x * x + y * y);
            if (d < L) {
              ctx.strokeStyle = 'rgba(' + col + ',' + (1 - d / L) * (dark ? 0.35 : 0.22) + ')';
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
          const g = 0.45 + 0.35 * Math.sin(a.p);
          ctx.fillStyle = 'rgba(' + col + ',' + (dark ? g : g * 0.7) + ')';
          ctx.beginPath();
          ctx.arc(a.x, a.y, a.r, 0, 6.283);
          ctx.fill();
        }
        if (run) raf = requestAnimationFrame(frame);
      }
      host.addEventListener(
        'mousemove',
        (e) => {
          const r = host.getBoundingClientRect();
          mouse.x = e.clientX - r.left;
          mouse.y = e.clientY - r.top;
        },
        { signal }
      );
      host.addEventListener(
        'mouseleave',
        () => {
          mouse.x = mouse.y = -9999;
        },
        { signal }
      );
      function start() {
        if (run) return;
        size();
        if (!W) return;
        run = true;
        if (RM) {
          run = false;
          frame();
          return;
        }
        raf = requestAnimationFrame(frame);
      }
      function stop() {
        run = false;
        cancelAnimationFrame(raf);
      }
      if ('IntersectionObserver' in window) {
        const hostIo = new IntersectionObserver(
          (en) => {
            en.forEach((e) => (e.isIntersecting ? start() : stop()));
          },
          { threshold: 0 }
        );
        hostIo.observe(host);
        cleanups.push(() => hostIo.disconnect());
      } else start();
      addEventListener('resize', () => run && size(), { signal });
      cleanups.push(() => cancelAnimationFrame(raf));
    });

    // ---- subtle 3D tilt on cards ----
    if (!RM && matchMedia('(hover:hover)').matches) {
      document.querySelectorAll<HTMLElement>('.ev-card,.mk-svc,.concept,.pkg,.sec-card,.tq,.ai-card,.tm').forEach((c) => {
        c.classList.add('tilt');
        c.addEventListener(
          'mousemove',
          (e) => {
            const r = c.getBoundingClientRect(),
              x = (e.clientX - r.left) / r.width - 0.5,
              y = (e.clientY - r.top) / r.height - 0.5;
            c.style.setProperty('--rx', (-y * 5).toFixed(2) + 'deg');
            c.style.setProperty('--ry', (x * 6).toFixed(2) + 'deg');
            c.style.setProperty('--mx', ((x + 0.5) * 100).toFixed(1) + '%');
            c.style.setProperty('--my', ((y + 0.5) * 100).toFixed(1) + '%');
          },
          { signal }
        );
        c.addEventListener(
          'mouseleave',
          () => {
            c.style.setProperty('--rx', '0deg');
            c.style.setProperty('--ry', '0deg');
          },
          { signal }
        );
      });
    }

    // ---- AI terminal typing ----
    document.querySelectorAll<HTMLElement>('.ai-term').forEach((t) => {
      const lines = JSON.parse(t.getAttribute('data-lines') || '[]') as [string, string?, string?][];
      let done = false;
      const timeouts: number[] = [];
      function type() {
        if (done) return;
        done = true;
        t.innerHTML = '';
        let li = 0;
        (function next() {
          if (li >= lines.length) {
            t.insertAdjacentHTML('beforeend', '<span class="cur"></span>');
            return;
          }
          const L = lines[li++];
          const row = document.createElement('div');
          t.appendChild(row);
          let k = 0;
          const txt = L[0];
          (function ch() {
            row.textContent = txt.slice(0, ++k);
            if (k < txt.length && !RM) {
              timeouts.push(window.setTimeout(ch, 14));
            } else {
              if (L[1]) row.insertAdjacentHTML('beforeend', ' <span class="' + L[2] + '">' + L[1] + '</span>');
              timeouts.push(window.setTimeout(next, RM ? 0 : 260));
            }
          })();
        })();
      }
      cleanups.push(() => timeouts.forEach((id) => clearTimeout(id)));
      if ('IntersectionObserver' in window) {
        const o = new IntersectionObserver(
          (en) => {
            if (en[0].isIntersecting) {
              type();
              o.disconnect();
            }
          },
          { threshold: 0.4 }
        );
        o.observe(t);
        cleanups.push(() => o.disconnect());
      } else type();
    });

    return () => {
      ac.abort();
      cleanups.forEach((fn) => fn());
    };
  }, [pathname]);

  return null;
}
