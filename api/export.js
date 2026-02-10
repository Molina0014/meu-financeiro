const sql = require("../lib/db");
const { corsHeaders } = require("../lib/validate");

module.exports = async function handler(req, res) {
    corsHeaders(res);

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    if (req.method !== "GET") {
        return res.status(405).json({ error: "Método não permitido" });
    }

    try {
        const { format, month } = req.query;

        let query = `SELECT t.id, t.type, t.category, t.description, t.amount::float, t.date::text, t.member, t.tags, t.account_id, a.name as account_name, t.is_recurring, t.recurrence, t.created_at
                      FROM transactions t LEFT JOIN accounts a ON t.account_id = a.id`;
        const params = [];

        if (month && /^\d{4}-\d{2}$/.test(month)) {
            params.push(month);
            query += ` WHERE to_char(t.date, 'YYYY-MM') = $1`;
        }

        query += ` ORDER BY t.date DESC, t.id DESC`;

        const rows = await sql.query(query, params);

        if (format === "csv") {
            const header = "ID,Tipo,Categoria,Descrição,Valor,Data,Membro,Tags,Conta,Recorrente,Recorrência";
            const csvRows = rows.map((r) => {
                const tags = Array.isArray(r.tags) ? r.tags.join(";") : "";
                return [
                    r.id,
                    r.type,
                    r.category,
                    `"${(r.description || "").replace(/"/g, '""')}"`,
                    r.amount,
                    r.date,
                    r.member || "Eu",
                    `"${tags}"`,
                    r.account_name || "",
                    r.is_recurring ? "Sim" : "Não",
                    r.recurrence || "",
                ].join(",");
            });
            const csv = "\uFEFF" + header + "\n" + csvRows.join("\n");
            const filename = month ? `transacoes_${month}.csv` : "transacoes.csv";
            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
            return res.send(csv);
        }

        // Default: JSON
        const filename = month ? `transacoes_${month}.json` : "transacoes.json";
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.json(rows);
    } catch (err) {
        console.error("export error:", err);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
};
