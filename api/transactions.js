const sql = require("../lib/db");
const {
    VALID_TYPES,
    VALID_CATEGORIES,
    corsHeaders,
} = require("../lib/validate");

module.exports = async function handler(req, res) {
    corsHeaders(res);

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    const { id } = req.query;

    try {
        // GET /api/transactions ou /api/transactions?id=X
        if (req.method === "GET") {
            if (id) {
                const rows = await sql.query(
                    `SELECT id, type, category, description, amount::float, date::text, created_at, updated_at
           FROM transactions WHERE id = $1`,
                    [id],
                );
                if (!rows.length)
                    return res
                        .status(404)
                        .json({ error: "Transação não encontrada" });
                return res.json(rows[0]);
            }

            const { type, category, month, from, to, sort, search } = req.query;
            const limit = Math.min(parseInt(req.query.limit) || 200, 1000);
            const offset = parseInt(req.query.offset) || 0;

            const conditions = [];
            const params = [];
            let paramIdx = 1;

            if (type && VALID_TYPES.includes(type)) {
                conditions.push(`type = $${paramIdx++}`);
                params.push(type);
            }
            if (category && VALID_CATEGORIES.includes(category)) {
                conditions.push(`category = $${paramIdx++}`);
                params.push(category);
            }
            if (month && /^\d{4}-\d{2}$/.test(month)) {
                conditions.push(
                    `date_trunc('month', date) = $${paramIdx++}::date`,
                );
                params.push(`${month}-01`);
            }
            if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
                conditions.push(`date >= $${paramIdx++}::date`);
                params.push(from);
            }
            if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
                conditions.push(`date <= $${paramIdx++}::date`);
                params.push(to);
            }
            if (search && search.trim()) {
                conditions.push(`description ILIKE $${paramIdx++}`);
                params.push(`%${search.trim()}%`);
            }

            const where = conditions.length
                ? `WHERE ${conditions.join(" AND ")}`
                : "";
            const orderDir = sort === "asc" ? "ASC" : "DESC";

            const rows = await sql.query(
                `SELECT id, type, category, description, amount::float, date::text, created_at, updated_at
         FROM transactions ${where}
         ORDER BY date ${orderDir}, id DESC
         LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
                [...params, limit, offset],
            );
            return res.json(rows);
        }

        // POST /api/transactions
        if (req.method === "POST") {
            const { type, category, amount, description, date } = req.body;

            if (!type || !VALID_TYPES.includes(type)) {
                return res
                    .status(400)
                    .json({
                        error: `type deve ser: ${VALID_TYPES.join(", ")}`,
                    });
            }
            if (!category || !VALID_CATEGORIES.includes(category)) {
                return res
                    .status(400)
                    .json({
                        error: `category deve ser: ${VALID_CATEGORIES.join(", ")}`,
                    });
            }
            const numAmount = parseFloat(amount);
            if (!numAmount || numAmount <= 0) {
                return res
                    .status(400)
                    .json({ error: "amount deve ser um número positivo" });
            }

            const rows = await sql.query(
                `INSERT INTO transactions (type, category, description, amount, date)
         VALUES ($1, $2, $3, $4, COALESCE($5::date, CURRENT_DATE))
         RETURNING id, type, category, description, amount::float, date::text, created_at, updated_at`,
                [type, category, description || "", numAmount, date || null],
            );
            return res.status(201).json(rows[0]);
        }

        // PUT /api/transactions?id=X
        if (req.method === "PUT") {
            if (!id) return res.status(400).json({ error: "id é obrigatório" });

            const { type, category, amount, description, date } = req.body;
            const sets = [];
            const params = [];
            let paramIdx = 1;

            if (type !== undefined) {
                if (!VALID_TYPES.includes(type))
                    return res.status(400).json({ error: "type inválido" });
                sets.push(`type = $${paramIdx++}`);
                params.push(type);
            }
            if (category !== undefined) {
                if (!VALID_CATEGORIES.includes(category))
                    return res.status(400).json({ error: "category inválida" });
                sets.push(`category = $${paramIdx++}`);
                params.push(category);
            }
            if (amount !== undefined) {
                const num = parseFloat(amount);
                if (!num || num <= 0)
                    return res.status(400).json({ error: "amount inválido" });
                sets.push(`amount = $${paramIdx++}`);
                params.push(num);
            }
            if (description !== undefined) {
                sets.push(`description = $${paramIdx++}`);
                params.push(description);
            }
            if (date !== undefined) {
                sets.push(`date = $${paramIdx++}::date`);
                params.push(date);
            }

            if (!sets.length)
                return res
                    .status(400)
                    .json({ error: "Nenhum campo para atualizar" });

            sets.push(`updated_at = NOW()`);
            params.push(id);

            const rows = await sql.query(
                `UPDATE transactions SET ${sets.join(", ")} WHERE id = $${paramIdx}
         RETURNING id, type, category, description, amount::float, date::text, created_at, updated_at`,
                params,
            );
            if (!rows.length)
                return res
                    .status(404)
                    .json({ error: "Transação não encontrada" });
            return res.json(rows[0]);
        }

        // DELETE /api/transactions?id=X
        if (req.method === "DELETE") {
            if (!id) return res.status(400).json({ error: "id é obrigatório" });

            const rows = await sql.query(
                "DELETE FROM transactions WHERE id = $1 RETURNING id",
                [id],
            );
            if (!rows.length)
                return res
                    .status(404)
                    .json({ error: "Transação não encontrada" });
            return res.json({ deleted: true, id: rows[0].id });
        }

        res.status(405).json({ error: "Método não permitido" });
    } catch (err) {
        console.error("transactions error:", err);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
};
