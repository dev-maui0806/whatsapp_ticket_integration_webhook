const { exec } = require('child_process');
const path = require('path');

async function deployWithFix() {
    console.log('🚀 Starting deployment with JSON parsing fix...');
    console.log('=====================================');
    
    try {
        // Step 1: Run the JSON parsing fix
        console.log('🔧 Step 1: Running JSON parsing fix...');
        await runScript('node fix-json-parsing-error.js');
        
        // Step 2: Run database migration if needed
        console.log('🔧 Step 2: Running database migration...');
        await runScript('node run-phone-migration.js');
        
        // Step 3: Run tests
        console.log('🧪 Step 3: Running tests...');
        await runScript('node test-phone-chat-system.js');
        
        console.log('');
        console.log('✅ Deployment with fix completed successfully!');
        console.log('🎉 Your application is ready to run without JSON parsing errors!');
        
    } catch (error) {
        console.error('❌ Deployment failed:', error.message);
        process.exit(1);
    }
}

function runScript(scriptPath) {
    return new Promise((resolve, reject) => {
        console.log(`   Running: ${scriptPath}`);
        
        const child = exec(`node ${scriptPath}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`   ❌ Error running ${scriptPath}:`, error.message);
                reject(error);
                return;
            }
            
            if (stderr) {
                console.log(`   ⚠️ Warnings from ${scriptPath}:`, stderr);
            }
            
            if (stdout) {
                console.log(`   📋 Output from ${scriptPath}:`);
                console.log(stdout);
            }
            
            console.log(`   ✅ ${scriptPath} completed successfully`);
            resolve();
        });
        
        child.stdout.on('data', (data) => {
            process.stdout.write(data);
        });
        
        child.stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}

// Run deployment
deployWithFix();
