const sql = require("../lib/db");
const { corsHeaders } = require("../lib/validate");

module.exports = async function handler(req, res) {
    corsHeaders(res);

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    try {
        // GET /api/budget?month=YYYY-MM
        if (req.method === "GET") {
            const { month } = req.query;
            if (!month || !/^\d{4}-\d{2}$/.test(month)) {
                return res.status(400).json({ error: "month deve ser YYYY-MM" });
            }
            const rows = await sql.query(
                `SELECT id, month, total_limit::float, created_at, updated_at
                 FROM budget WHERE month = $1`,
                [month],
            );
            if (!rows.length) {
                return res.json({ month, total_limit: null });
            }
            return res.json(rows[0]);
        }

        // POST /api/budget — upsert
        if (req.method === "POST") {
            const { month, total_limit } = req.body;
            if (!month || !/^\d{4}-\d{2}$/.test(month)) {
                return res.status(400).json({ error: "month deve ser YYYY-MM" });
            }
            const limit = parseFloat(total_limit);
            if (!limit || limit <= 0) {
                return res.status(400).json({ error: "total_limit deve ser positivo" });
            }
            const rows = await sql.query(
                `INSERT INTO budget (month, total_limit)
                 VALUES ($1, $2)
                 ON CONFLICT (month) DO UPDATE SET total_limit = $2, updated_at = NOW()
                 RETURNING id, month, total_limit::float, created_at, updated_at`,
                [month, limit],
            );
            return res.status(201).json(rows[0]);
        }

        res.status(405).json({ error: "Método não permitido" });
    } catch (err) {
        console.error("budget error:", err);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
};
