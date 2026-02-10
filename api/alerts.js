const sql = require("../lib/db");
const { corsHeaders } = require("../lib/validate");

module.exports = async function handler(req, res) {
    corsHeaders(res);

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    try {
        // GET /api/alerts — list alerts (last 50, unread first)
        if (req.method === "GET") {
            const rows = await sql.query(
                `SELECT id, type, message, data, read, created_at
                 FROM alerts
                 ORDER BY read ASC, created_at DESC
                 LIMIT 50`,
            );
            return res.json(rows);
        }

        // POST /api/alerts — create alert
        if (req.method === "POST") {
            const { type, message, data } = req.body;
            if (!type || !message) {
                return res.status(400).json({ error: "type e message são obrigatórios" });
            }
            const rows = await sql.query(
                `INSERT INTO alerts (type, message, data)
                 VALUES ($1, $2, $3)
                 RETURNING id, type, message, data, read, created_at`,
                [type, message, data ? JSON.stringify(data) : "{}"],
            );
            return res.status(201).json(rows[0]);
        }

        // PUT /api/alerts/:id — mark as read
        if (req.method === "PUT") {
            const { id } = req.query;
            if (!id) {
                return res.status(400).json({ error: "id é obrigatório" });
            }
            const rows = await sql.query(
                `UPDATE alerts SET read = true WHERE id = $1
                 RETURNING id, type, message, data, read, created_at`,
                [id],
            );
            if (!rows.length) {
                return res.status(404).json({ error: "Alerta não encontrado" });
            }
            return res.json(rows[0]);
        }

        res.status(405).json({ error: "Método não permitido" });
    } catch (err) {
        console.error("alerts error:", err);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
};
