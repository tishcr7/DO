const express = require('express');
const sql = require('mssql');
const cors = require('cors');

const app = express();
app.use(cors()); // Allows your HTML file to talk to this API
app.use(express.json());

// --- DATABASE CONFIGURATION ---
const dbConfig = {
    user: 'LSP',
    password: 'Loongsen@2025',
    server: 'svr-mits.database.windows.net',
    database: 'LoongSen',
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

// --- HEALTH CHECK (For Render) ---
app.get('/', (req, res) => {
    res.send("DO Maker API is Running 🚀");
});

// --- ENDPOINT 1: GET CUSTOMER DETAILS ---
// Usage: /api/customer/Y022
app.get('/api/customer/:code', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('code', sql.NVarChar, req.params.code)
            .query(`
                SELECT TOP 1 
                    CustName, 
                    ShippingAddrs, 
                    BillingAddrs, 
                    Tel_1, 
                    Fax_1 
                FROM dbo.tblSystem_Config_CustInfo 
                WHERE CustID = @code
            `);

        if (result.recordset.length > 0) {
            const r = result.recordset[0];
            // Logic: Use Shipping Address, fallback to Billing if empty
            const rawAddress = r.ShippingAddrs || r.BillingAddrs || "";
            
            res.json({
                success: true,
                name: r.CustName,
                address: rawAddress, // We will split this in the frontend
                tel: r.Tel_1,
                fax: r.Fax_1
            });
        } else {
            res.status(404).json({ success: false, message: "Customer Not Found" });
        }
    } catch (err) {
        console.error("SQL Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- ENDPOINT 2: GET JOB ORDER DETAILS ---
// Usage: /api/job/JO-25112642
app.get('/api/job/:jobNo', async (req, res) => {
    try {
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('jobNo', sql.NVarChar, req.params.jobNo)
            .query(`
                SELECT TOP 1
                    P.LotNo AS JobOrder,
                    O.PONo,
                    C.StkDesc AS Description,
                    C.SizeWidth, C.SizeLength, C.SizeThick,
                    C.Measurement,
                    O.CustCode -- We fetch this to cross-check if needed
                FROM dbo.tblProd_Trans_PlanMs AS P
                LEFT JOIN dbo.tblCS_Config_ProductNo AS C ON P.StkCode = C.StkCode
                LEFT JOIN dbo.tblCS_Trans_OrderMs AS O ON P.OrderID = O.TransID
                WHERE P.LotNo = @jobNo
            `);

        if (result.recordset.length > 0) {
            const r = result.recordset[0];
            res.json({
                success: true,
                jobOrder: r.JobOrder,
                poNumber: r.PONo || "-",
                description: r.Description,
                // Create a clean "Size" string (e.g., "10 x 20 x 0.05")
                sizeString: `${r.SizeWidth} x ${r.SizeLength} x ${r.SizeThick}`,
                custCode: r.CustCode
            });
        } else {
            res.status(404).json({ success: false, message: "Job Order Not Found" });
        }
    } catch (err) {
        console.error("SQL Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});