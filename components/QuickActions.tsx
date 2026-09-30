export default function QuickActions() {
  return (
    <div className={"quick-actions"} aria-label={"Quick actions"}>
      <a className={"qa-tab qa-quote"} href={"/contact"}>
        <svg viewBox={"0 0 24 24"} aria-hidden={"true"}><path d={"M4 4h16v12H7l-3 3V4z"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.6"} strokeLinejoin={"round"} /></svg>
        <span>{"Request quote"}</span>
      </a>
      <a className={"qa-tab qa-call"} href={"tel:+441613941144"}>
        <svg viewBox={"0 0 24 24"} aria-hidden={"true"}><path d={"M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.4"} strokeLinejoin={"round"} /></svg>
        <span>{"Call us"}</span>
      </a>
      <a className={"qa-tab qa-email"} href={"mailto:info@cosmeticsciencelab.com"}>
        <svg viewBox={"0 0 24 24"} aria-hidden={"true"}><path d={"M4 5h16v14H4z"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.6"} strokeLinejoin={"round"} /><path d={"M4 6l8 7 8-7"} fill={"none"} stroke={"currentColor"} strokeWidth={"1.6"} strokeLinejoin={"round"} /></svg>
        <span>{"Email us"}</span>
      </a>
    </div>
  );
}
