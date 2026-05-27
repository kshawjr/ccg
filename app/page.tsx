export default function Landing() {
  return (
    <main className="landing">
      <div className="landing-card">
        <div className="landing-dots" aria-hidden="true">
          <span style={{ background: '#D85A30' }} />
          <span style={{ background: '#378ADD' }} />
          <span style={{ background: '#BA7517' }} />
          <span style={{ background: '#639922' }} />
        </div>
        <p className="landing-eyebrow">True colors assessment</p>
        <h1 className="landing-title">You&rsquo;re in the right place.</h1>
        <p className="landing-body">
          Open the personal link sent to you by Corporate Cleaning Group to start the assessment.
        </p>
      </div>
    </main>
  );
}
