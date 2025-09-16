const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load test payloads
const testPayloads = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-payloads.json'), 'utf8'));

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:4000',
  webhookEndpoint: '/webhook',
  testPhoneNumber: '+48794740269',
  testAgentId: 1
};

class WebhookTester {
  constructor() {
    this.results = [];
  }

  async runTest(testName, payload) {
    console.log(`\n🧪 Running test: ${testName}`);
    console.log('=' .repeat(50));
    
    try {
      const response = await axios.post(
        `${TEST_CONFIG.baseUrl}${TEST_CONFIG.webhookEndpoint}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const result = {
        testName,
        status: 'SUCCESS',
        statusCode: response.status,
        response: response.data,
        timestamp: new Date().toISOString()
      };

      console.log('✅ Test passed');
      console.log('Status:', response.status);
      console.log('Response:', JSON.stringify(response.data, null, 2));
      
      this.results.push(result);
      return result;

    } catch (error) {
      const result = {
        testName,
        status: 'FAILED',
        error: error.message,
        statusCode: error.response?.status,
        response: error.response?.data,
        timestamp: new Date().toISOString()
      };

      console.log('❌ Test failed');
      console.log('Error:', error.message);
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Response:', JSON.stringify(error.response.data, null, 2));
      }
      
      this.results.push(result);
      return result;
    }
  }

  async testWebhookVerification() {
    console.log('\n🔐 Testing webhook verification...');
    
    try {
      const response = await axios.get(
        `${TEST_CONFIG.baseUrl}${TEST_CONFIG.webhookEndpoint}`,
        {
          params: {
            'hub.mode': 'subscribe',
            'hub.verify_token': 'test_verify_token_12345',
            'hub.challenge': 'test_challenge_12345'
          }
        }
      );

      if (response.data === 'test_challenge_12345') {
        console.log('✅ Webhook verification successful');
        return { status: 'SUCCESS', message: 'Verification passed' };
      } else {
        console.log('❌ Webhook verification failed');
        return { status: 'FAILED', message: 'Invalid challenge response' };
      }
    } catch (error) {
      console.log('❌ Webhook verification error:', error.message);
      return { status: 'FAILED', error: error.message };
    }
  }

  async testTicketAPI() {
    console.log('\n🎫 Testing ticket API endpoints...');
    
    try {
      // Test getting tickets
      const ticketsResponse = await axios.get(`${TEST_CONFIG.baseUrl}/api/tickets`);
      console.log('✅ Tickets API working');
      console.log('Tickets count:', ticketsResponse.data.data?.length || 0);

      // Test webhook logs
      const logsResponse = await axios.get(`${TEST_CONFIG.baseUrl}/webhook/webhook-logs`);
      console.log('✅ Webhook logs API working');
      console.log('Logs count:', logsResponse.data.data?.length || 0);

      return { status: 'SUCCESS', message: 'API endpoints working' };
    } catch (error) {
      console.log('❌ API test failed:', error.message);
      return { status: 'FAILED', error: error.message };
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Webhook Testing Suite');
    console.log('=====================================');
    console.log(`Testing against: ${TEST_CONFIG.baseUrl}`);
    console.log(`Test phone number: ${TEST_CONFIG.testPhoneNumber}`);

    // Test webhook verification
    await this.testWebhookVerification();

    // Test API endpoints
    await this.testTicketAPI();

    // Test webhook payloads
    const payloads = testPayloads.sampleWebhookPayloads;
    
    await this.runTest('New Customer Message', payloads.newCustomerMessage);
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await this.runTest('Existing Customer Message', payloads.existingCustomerMessage);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await this.runTest('Ticket Details Message', payloads.ticketDetailsMessage);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await this.runTest('Button Response', payloads.buttonResponse);

    // Generate test report
    this.generateReport();
  }

  generateReport() {
    console.log('\n📊 Test Report');
    console.log('==============');
    
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.status === 'SUCCESS').length;
    const failedTests = this.results.filter(r => r.status === 'FAILED').length;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => r.status === 'FAILED')
        .forEach(r => {
          console.log(`- ${r.testName}: ${r.error}`);
        });
    }

    // Save detailed report
    const reportPath = path.join(__dirname, 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate: ((passedTests / totalTests) * 100).toFixed(1)
      },
      results: this.results,
      timestamp: new Date().toISOString()
    }, null, 2));

    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new WebhookTester();
  tester.runAllTests().catch(console.error);
}

module.exports = WebhookTester;

