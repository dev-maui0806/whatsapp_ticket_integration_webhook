const mysql = require('mysql2');
require('dotenv').config();

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'whatsapp_ticketing',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    port:process.env.DB_PORT || 3306,
    ssl: {
        mode: 'required',
        rejectUnauthorized: false // Aiven free plan
    }
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Create promise-based pool
const promisePool = pool.promise();

// Test database connection
const testConnection = async () => {
    try {
        const connection = await promisePool.getConnection();
        console.log('✅ Database connected successfully');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
};

// Execute query with error handling
const executeQuery = async (query, params = []) => {
    try {
        console.log("_______111___", query, );
        console.log("_________222______", params);
        const [rows] = await promisePool.execute(query, params);
        return { success: true, data: rows };
    } catch (error) {
        console.error('Database query error:', error);
        return { success: false, error: error.message };
    }
};

// Execute transaction
const executeTransaction = async (queries) => {

    console.log("_____________", dbConfig)
    const connection = await promisePool.getConnection();
    try {
        await connection.beginTransaction();
        
        const results = [];
        for (const { query, params } of queries) {
            const [rows] = await connection.execute(query, params);
            results.push(rows);
        }
        
        await connection.commit();
        return { success: true, data: results };
    } catch (error) {
        await connection.rollback();
        console.error('Transaction error:', error);
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
};

module.exports = {
    pool: promisePool,
    testConnection,
    executeQuery,
    executeTransaction
};
