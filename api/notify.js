const sql = require("../lib/db");
const { corsHeaders } = require("../lib/validate");

module.exports = async function handler(req, res) {
    corsHeaders(res);

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método não permitido" });
    }

    // Verify API key
    const apiKey = process.env.API_KEY;
    const provided = req.headers["x-api-key"];
    if (apiKey && provided !== apiKey) {
        return res.status(401).json({ error: "API key inválida" });
    }

    try {
        const { title, message, type, data } = req.body;
        if (!message) {
            return res.status(400).json({ error: "message é obrigatório" });
        }

        const alertType = ["info", "warning", "danger", "success"].includes(type) ? type : "info";
        const alertMessage = title ? `${title}: ${message}` : message;

        const rows = await sql.query(
            `INSERT INTO alerts (type, message, data)
             VALUES ($1, $2, $3)
             RETURNING id, type, message, data, read, created_at`,
            [alertType, alertMessage, data ? JSON.stringify(data) : "{}"],
        );

        return res.status(201).json(rows[0]);
    } catch (err) {
        console.error("notify error:", err);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
};
