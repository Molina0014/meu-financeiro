const sql = require("../lib/db");
const { VALID_TYPES, VALID_CATEGORIES, corsHeaders } = require("../lib/validate");

module.exports = async function handler(req, res) {
    corsHeaders(res);

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Método não permitido" });
    }

    try {
        const { transactions, account_id } = req.body;

        if (!Array.isArray(transactions) || !transactions.length) {
            return res.status(400).json({ error: "transactions deve ser um array não vazio" });
        }

        const imported = [];
        const errors = [];

        for (let i = 0; i < transactions.length; i++) {
            const tx = transactions[i];
            try {
                const type = VALID_TYPES.includes(tx.type) ? tx.type : "expense";
                const category = VALID_CATEGORIES.includes(tx.category) ? tx.category : "outros";
                const amount = parseFloat(tx.amount);
                if (!amount || amount <= 0) {
                    errors.push({ index: i, error: "amount inválido", data: tx });
                    continue;
                }
                const description = tx.description || tx.desc || "";
                const date = tx.date || null;
                const accId = tx.account_id || account_id || null;

                const rows = await sql.query(
                    `INSERT INTO transactions (type, category, description, amount, date, account_id)
                     VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE), $6)
                     RETURNING id, type, category, description, amount::float, date::text`,
                    [type, category, description, amount, date, accId ? parseInt(accId) : null],
                );
                imported.push(rows[0]);
            } catch (txErr) {
                errors.push({ index: i, error: txErr.message, data: tx });
            }
        }

        return res.status(201).json({ imported: imported.length, errors, transactions: imported });
    } catch (err) {
        console.error("import error:", err);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
};
