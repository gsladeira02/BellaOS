module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const handle = String(body.handle || '').replace(/^\$/, '').trim();
    const orderNsu = String(body.order_nsu || `bellaos-${Date.now()}`);
    const plan = body.plan || {};
    const salon = body.salon || {};
    const customer = body.customer || {};
    const metadata = body.metadata || {};
    const price = Number(plan.price || 6990);

    if (!handle) return res.status(400).json({ error: 'InfiniteTag não configurada.' });
    if (!price || price < 100) return res.status(400).json({ error: 'Valor inválido.' });

    const host = req.headers['x-forwarded-host'] || req.headers.host || 'bella-os.vercel.app';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = `${proto}://${host}`;

    const payload = {
      handle,
      redirect_url: `${baseUrl}/pagamento-concluido?order_nsu=${encodeURIComponent(orderNsu)}`,
      webhook_url: `${baseUrl}/api/infinitepay-webhook`,
      order_nsu: orderNsu,
      customer: {
        name: customer.name || salon.name || 'Cliente BellaOS',
        email: customer.email || undefined,
        phone_number: customer.phone_number || undefined
      },
      items: [
        {
          quantity: 1,
          price,
          description: `${plan.name || 'BellaOS Completo'}${plan.display ? ` (${plan.display})` : ''} - ${salon.name || 'Salão'}`
        }
      ]
    };

    Object.keys(payload.customer).forEach(key => payload.customer[key] === undefined && delete payload.customer[key]);
    if (!Object.keys(payload.customer).length) delete payload.customer;

    const response = await fetch('https://api.checkout.infinitepay.io/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.message || data?.error || 'Erro ao gerar checkout InfinitePay.', details: data });
    }

    return res.status(200).json({ url: data.url, order_nsu: orderNsu });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro interno.' });
  }
};
