async function testBatchAnalysis() {
  try {
    console.log('Testing batch analysis endpoint...');
    
    const response = await fetch('https://github-ai-intelligence.nkostov.workers.dev/api/analyze/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ target: 'visible' })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Batch analysis response:', data);
  } catch (error) {
    console.error('Error testing batch analysis:', error);
  }
}

testBatchAnalysis();
