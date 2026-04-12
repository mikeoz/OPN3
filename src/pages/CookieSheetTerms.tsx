import { Helmet } from "react-helmet-async";

export default function CookieSheetTerms() {
  return (
    <>
      <Helmet>
        <title>Cookie Sheet — Terms of Service | Opn.li</title>
        <meta name="description" content="Terms of service for Cookie Sheet, a free browser extension by Opn.li." />
      </Helmet>
      <div className="min-h-screen bg-white">
        <header className="border-b border-gray-100">
          <div className="mx-auto max-w-[720px] px-6 py-6">
            <a href="https://opn.li" className="text-lg font-semibold tracking-tight text-gray-900">Opn.li</a>
          </div>
        </header>

        <main className="mx-auto max-w-[720px] px-6 py-12">
          <article className="prose prose-gray max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed prose-li:text-gray-700 prose-strong:text-gray-900 prose-a:text-blue-600 hover:prose-a:text-blue-800">
            <h1>Cookie Sheet — Terms of Service</h1>

            <p><strong>Last updated: April 9, 2026</strong></p>

            <h2>Acceptance of Terms</h2>
            <p>By installing and using Cookie Sheet, you agree to these terms. If you do not agree, please uninstall the extension.</p>

            <h2>What Cookie Sheet Is</h2>
            <p>Cookie Sheet is a free browser extension that reads the cookies stored in your browser and displays them in a human-readable format. It is a transparency tool designed to help you understand what cookies websites are setting in your browser.</p>

            <h2>What Cookie Sheet Is Not</h2>
            <p>Cookie Sheet is not a security tool, antivirus software, or comprehensive privacy solution. It shows you cookies visible through the browser's cookies API. It does not detect or protect against all forms of tracking, including browser fingerprinting, server-side tracking, localStorage, or pixel tracking.</p>
            <p>Cookie Sheet's cookie classifications are based on known databases and heuristic pattern matching. Classifications may not always be accurate. Cookies labeled as "unknown" have not been identified by our classification engine.</p>

            <h2>No Warranty</h2>
            <p>Cookie Sheet is provided "as is" without warranty of any kind, express or implied. Opn.li does not guarantee that the extension will be error-free, that cookie classifications will be accurate, or that the extension will detect all cookies on every website.</p>

            <h2>Limitation of Liability</h2>
            <p>To the maximum extent permitted by applicable law, Opn.li shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of Cookie Sheet.</p>

            <h2>Changes</h2>
            <p>We may update these terms from time to time. Continued use of Cookie Sheet after changes constitutes acceptance of the updated terms.</p>

            <h2>Contact</h2>
            <p>Questions about these terms can be directed to: <a href="mailto:terms@opn.li">terms@opn.li</a></p>

            <hr />

            <p className="text-center"><strong>Opn.li — Trust infrastructure for the agentic web</strong></p>
          </article>
        </main>

        <footer className="border-t border-gray-100">
          <div className="mx-auto max-w-[720px] px-6 py-6 text-center text-sm text-gray-400">
            © {new Date().getFullYear()} Opn.li. All rights reserved.
          </div>
        </footer>
      </div>
    </>
  );
}
