const sql = require("../lib/db");
const { corsHeaders } = require("../lib/validate");

module.exports = async function handler(req, res) {
    corsHeaders(res);

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    const { id } = req.query;

    try {
        // GET /api/accounts
        if (req.method === "GET") {
            if (id) {
                const rows = await sql.query(
                    `SELECT id, name, icon, color, created_at FROM accounts WHERE id = $1`,
                    [id],
                );
                if (!rows.length)
                    return res.status(404).json({ error: "Conta não encontrada" });
                return res.json(rows[0]);
            }
            const rows = await sql.query(
                `SELECT id, name, icon, color, created_at FROM accounts ORDER BY id`,
            );
            return res.json(rows);
        }

        // POST /api/accounts
        if (req.method === "POST") {
            const { name, icon, color } = req.body;
            if (!name || !name.trim()) {
                return res.status(400).json({ error: "name é obrigatório" });
            }
            const rows = await sql.query(
                `INSERT INTO accounts (name, icon, color)
                 VALUES ($1, $2, $3)
                 RETURNING id, name, icon, color, created_at`,
                [name.trim(), icon || "💳", color || "#1e2a5e"],
            );
            return res.status(201).json(rows[0]);
        }

        // PUT /api/accounts?id=X
        if (req.method === "PUT") {
            if (!id) return res.status(400).json({ error: "id é obrigatório" });
            const { name, icon, color } = req.body;
            const sets = [];
            const params = [];
            let paramIdx = 1;

            if (name !== undefined) {
                sets.push(`name = $${paramIdx++}`);
                params.push(name.trim());
            }
            if (icon !== undefined) {
                sets.push(`icon = $${paramIdx++}`);
                params.push(icon);
            }
            if (color !== undefined) {
                sets.push(`color = $${paramIdx++}`);
                params.push(color);
            }

            if (!sets.length)
                return res.status(400).json({ error: "Nenhum campo para atualizar" });

            params.push(id);
            const rows = await sql.query(
                `UPDATE accounts SET ${sets.join(", ")} WHERE id = $${paramIdx}
                 RETURNING id, name, icon, color, created_at`,
                params,
            );
            if (!rows.length)
                return res.status(404).json({ error: "Conta não encontrada" });
            return res.json(rows[0]);
        }

        // DELETE /api/accounts?id=X
        if (req.method === "DELETE") {
            if (!id) return res.status(400).json({ error: "id é obrigatório" });
            const rows = await sql.query(
                "DELETE FROM accounts WHERE id = $1 RETURNING id",
                [id],
            );
            if (!rows.length)
                return res.status(404).json({ error: "Conta não encontrada" });
            return res.json({ deleted: true, id: rows[0].id });
        }

        res.status(405).json({ error: "Método não permitido" });
    } catch (err) {
        console.error("accounts error:", err);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
};
