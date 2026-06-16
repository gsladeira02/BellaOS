module.exports = async function handler(req, res) {
  // A InfinitePay envia notificações de pagamento aprovado para esta rota.
  // Nesta versão estática, respondemos 200 para evitar novas tentativas.
  // Para produção completa, grave req.body em uma tabela de pagamentos no Supabase
  // e atualize o status da assinatura do salão pelo order_nsu.
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }
  return res.status(200).json({ ok: true });
};
