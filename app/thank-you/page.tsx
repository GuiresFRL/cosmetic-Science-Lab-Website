export const metadata = { title: "Thank you · Cosmetic Science Lab" };

export default function Page() {
  return (
    <header className={"page-hero"}><div className={"wrap"} style={{"gridTemplateColumns": "1fr"}}><div><p className={"eyebrow"}>{"Enquiry received"}</p><h1>{"Thank you. "}<em>{"We’re on it."}</em></h1><p className={"lede"}>{"A scientist will read your brief and reply within one working day. If you asked for an NDA, it will come first."}</p><div className={"hero-ctas"}><a className={"btn btn-dark"} href={"/process"}>{"See how we work"}</a><a className={"btn btn-line"} href={"/insights"}>{"Read our insights"}</a></div></div></div></header>
  );
}
