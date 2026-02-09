const sql = require('../lib/db');
const { VALID_CATEGORIES, corsHeaders } = require('../lib/validate');

module.exports = async function handler(req, res) {
  corsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { id } = req.query;

  try {
    // GET /api/goals
    if (req.method === 'GET') {
      const rows = await sql.query(
        `SELECT id, category, monthly_limit::float, created_at, updated_at
         FROM goals ORDER BY category`
      );
      return res.json(rows);
    }

    // POST /api/goals (upsert)
    if (req.method === 'POST') {
      const { category, monthly_limit } = req.body;

      if (!category || !VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: `category deve ser: ${VALID_CATEGORIES.join(', ')}` });
      }
      const num = parseFloat(monthly_limit);
      if (!num || num <= 0) {
        return res.status(400).json({ error: 'monthly_limit deve ser um número positivo' });
      }

      const rows = await sql.query(
        `INSERT INTO goals (category, monthly_limit)
         VALUES ($1, $2)
         ON CONFLICT (category) DO UPDATE SET monthly_limit = $2, updated_at = NOW()
         RETURNING id, category, monthly_limit::float, created_at, updated_at`,
        [category, num]
      );
      return res.status(201).json(rows[0]);
    }

    // PUT /api/goals?id=X
    if (req.method === 'PUT') {
      if (!id) return res.status(400).json({ error: 'id é obrigatório' });

      const { category, monthly_limit } = req.body;
      const sets = [];
      const params = [];
      let paramIdx = 1;

      if (category !== undefined) {
        if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ error: 'category inválida' });
        sets.push(`category = $${paramIdx++}`);
        params.push(category);
      }
      if (monthly_limit !== undefined) {
        const num = parseFloat(monthly_limit);
        if (!num || num <= 0) return res.status(400).json({ error: 'monthly_limit inválido' });
        sets.push(`monthly_limit = $${paramIdx++}`);
        params.push(num);
      }

      if (!sets.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });

      sets.push(`updated_at = NOW()`);
      params.push(id);

      const rows = await sql.query(
        `UPDATE goals SET ${sets.join(', ')} WHERE id = $${paramIdx}
         RETURNING id, category, monthly_limit::float, created_at, updated_at`,
        params
      );
      if (!rows.length) return res.status(404).json({ error: 'Meta não encontrada' });
      return res.json(rows[0]);
    }

    // DELETE /api/goals?id=X
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'id é obrigatório' });

      const rows = await sql.query(
        'DELETE FROM goals WHERE id = $1 RETURNING id', [id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Meta não encontrada' });
      return res.json({ deleted: true, id: rows[0].id });
    }

    res.status(405).json({ error: 'Método não permitido' });
  } catch (err) {
    console.error('goals error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
