const VALID_TYPES = ['income', 'expense'];

const VALID_CATEGORIES = [
  'alimentacao', 'transporte', 'lazer', 'saude',
  'educacao', 'moradia', 'salario', 'outros'
];

function corsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = { VALID_TYPES, VALID_CATEGORIES, corsHeaders };
