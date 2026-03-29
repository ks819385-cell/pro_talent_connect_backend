const fs = require('fs');
const path = require('path');

const resultsPath = path.join(__dirname, 'test-results.json');
const reportPath = path.join(__dirname, 'test-report.html');

if (!fs.existsSync(resultsPath)) {
    console.error('test-results.json not found! Run npm run test:json first.');
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

const totalTests = data.numTotalTests;
const passedTests = data.numPassedTests;
const failedTests = data.numFailedTests;
const score = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(2) : 0;
const status = failedTests === 0 ? 'PASS' : 'FAIL';
const color = failedTests === 0 ? '#28a745' : '#dc3545';

const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Results - Pro-Talent-Connect</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 40px auto; padding: 20px; background-color: #f4f7f6; }
        .card { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { margin-top: 0; color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0; }
        .stat-item { padding: 20px; border-radius: 6px; text-align: center; background: #f8f9fa; }
        .stat-value { font-size: 2.5em; font-weight: bold; display: block; }
        .stat-label { color: #7f8c8d; text-transform: uppercase; font-size: 0.9em; letter-spacing: 1px; }
        .score-box { background: ${color}; color: white; padding: 20px; border-radius: 6px; text-align: center; margin-top: 20px; }
        .score-value { font-size: 3em; font-weight: bold; }
        .status-pill { display: inline-block; padding: 5px 15px; border-radius: 20px; color: white; font-weight: bold; background: ${color}; margin-top: 10px; }
        .timestamp { text-align: right; color: #95a5a6; font-size: 0.8em; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="card">
        <h1>Pro-Talent-Connect Test Report</h1>
        <div class="stat-grid">
            <div class="stat-item">
                <span class="stat-value">${totalTests}</span>
                <span class="stat-label">Total Tests</span>
            </div>
            <div class="stat-item">
                <span class="stat-value" style="color: #28a745;">${passedTests}</span>
                <span class="stat-label">Passed</span>
            </div>
            <div class="stat-item">
                <span class="stat-value" style="color: #dc3545;">${failedTests}</span>
                <span class="stat-label">Failed</span>
            </div>
            <div class="stat-item">
                <span class="stat-value">${data.numTotalTestSuites}</span>
                <span class="stat-label">Test Suites</span>
            </div>
        </div>
        <div class="score-box">
            <div class="stat-label" style="color: rgba(255,255,255,0.8)">Testing Score</div>
            <div class="score-value">${score}%</div>
            <div class="status-pill">${status}</div>
        </div>
        <div class="timestamp">Generated on: ${new Date().toLocaleString()}</div>
    </div>
</body>
</html>
`;

fs.writeFileSync(reportPath, htmlTemplate);
console.log('Report generated at ' + reportPath);
