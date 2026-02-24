// Test script to verify the model name field fix
const PRODUCTION_URL = 'https://github-ai-intelligence.nkostov.workers.dev';

async function testModelNameField() {
  console.log('🔍 Testing model name field in analysis response...\n');
  
  const testRepo = 'XingangPan/DragGAN';
  const url = `${PRODUCTION_URL}/api/analyze/${testRepo}`;
  
  try {
    console.log(`📡 Fetching: ${url}`);
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`\n✅ Response Status: ${response.status}`);
    
    if (data.analysis) {
      console.log('\n🔍 Checking model field:');
      console.log(`- model: ${data.analysis.model || 'NOT FOUND'}`);
      console.log(`- model_used: ${data.analysis.model_used || 'NOT FOUND'}`);
      
      // Check which field contains the model information
      if (data.analysis.model_used) {
        console.log(`\n✅ SUCCESS: model_used field is present!`);
        console.log(`- Model used: ${data.analysis.model_used}`);
        
        // Check if it's a specific model name or generic
        if (data.analysis.model_used.includes('claude-') && data.analysis.model_used.includes('-20')) {
          console.log('- Displays specific Claude model version ✅');
        } else {
          console.log('- Displays generic model name ⚠️');
        }
      } else if (data.analysis.model) {
        console.log(`\n⚠️  WARNING: Using 'model' field instead of 'model_used'`);
        console.log(`- Model: ${data.analysis.model}`);
      } else {
        console.log('\n❌ ERROR: No model field found in response');
      }
      
      // Show the bottom section that would be displayed
      console.log('\n📄 Analysis page would display:');
      console.log(`"Analysis performed using ${data.analysis.model_used || data.analysis.model || 'Claude AI'}"`);
      
    } else {
      console.log('\n⚠️  No analysis data found in response');
    }
    
  } catch (error) {
    console.error('\n❌ Error testing endpoint:', error);
  }
}

// Run the test
testModelNameField();
