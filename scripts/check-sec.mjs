// Opt-in live validation. This is separate from offline tests and never uses fixture contacts.
const base = 'http://127.0.0.1:3001';
const health = await (await fetch(`${base}/api/health`)).json();
if (!health.secConfigured)
  throw new Error(
    'Set SEC_USER_AGENT with a genuine contact and restart the API before running this check.',
  );
const response = await fetch(`${base}/api/sec/company?identifier=MSFT&years=5`, {
  signal: AbortSignal.timeout(150_000),
});
const result = await response.json();
if (!response.ok) throw new Error(result.error?.message ?? `HTTP ${response.status}`);
if (result.company.cik !== '0000789019' || result.periods.length < 3)
  throw new Error(
    'The representative issuer or minimum annual-report coverage could not be verified.',
  );
const downloaded = await fetch(`${base}${result.facts.downloadPath}`);
if (!downloaded.ok) throw new Error('The source-fingerprinted raw facts could not be downloaded.');
const facts = await downloaded.json();
if (facts.cik !== 789019) throw new Error('Downloaded facts belong to a different issuer.');
console.log(
  JSON.stringify(
    {
      company: result.company.name,
      periods: result.periods.map((p) => p.periodEnd),
      concepts: result.facts.conceptCount,
      sha256: result.facts.sha256,
      status:
        'Live SEC retrieval passed; numerical statement reconciliation remains a separate step.',
    },
    null,
    2,
  ),
);
