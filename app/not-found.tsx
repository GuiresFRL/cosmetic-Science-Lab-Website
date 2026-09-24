export const metadata = { title: "Page not found · Cosmetic Science Lab" };

export default function NotFound() {
  return (
    <header className={"page-hero"}><div className={"wrap"} style={{"gridTemplateColumns": "1fr"}}><div><p className={"eyebrow"}>{"Error 404"}</p><h1>{"This page "}<em>{"isn’t here."}</em></h1><p className={"lede"}>{"It may have moved when we launched the new site. Try one of these instead."}</p><div className={"hero-ctas"}><a className={"btn btn-dark"} href={"/"}>{"Home"}</a><a className={"btn btn-line"} href={"/formulation"}>{"Formulation"}</a><a className={"btn btn-line"} href={"/regulatory"}>{"Markets"}</a><a className={"btn btn-line"} href={"/contact"}>{"Contact"}</a></div></div></div></header>
  );
}
