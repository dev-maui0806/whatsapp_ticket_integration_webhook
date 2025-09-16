const { executeQuery } = require('./config/database');

async function checkDatabase() {
    try {
        console.log('Checking database tables...');
        const result = await executeQuery('SHOW TABLES');
        
        if (result.success) {
            console.log('Tables:', result.data.map(t => Object.values(t)[0]));
        } else {
            console.error('Error:', result.error);
        }
    } catch (error) {
        console.error('Database check failed:', error.message);
    }
}

checkDatabase();
