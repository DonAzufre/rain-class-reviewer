function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isAuthError(err) {
  const message = err?.message || '';
  return /UNAUTHENTICATED|未登录|登录|sessionid|csrftoken/i.test(message);
}

export async function fetchJson(url, options = {}, retry = 3) {
  const { headers, body, method = 'GET' } = options;
  let lastError;

  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        redirect: 'follow',
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error(`接口返回非 JSON: ${text.slice(0, 200)}`);
      }

      if (!response.ok) {
        throw new Error(`接口 HTTP ${response.status}: ${data.msg || data.errmsg || response.statusText}`);
      }

      if (data.errcode !== undefined && data.errcode !== 0) {
        throw new Error(`接口业务错误 [${data.errcode}]: ${data.errmsg || '未知错误'}`);
      }

      if (data.code !== undefined && data.code !== 0) {
        throw new Error(`接口业务错误 [${data.code}]: ${data.msg || '未知错误'}`);
      }

      return data.data;
    } catch (err) {
      lastError = err;

      if (isAuthError(err)) {
        // 认证错误不重试，直接抛出
        throw err;
      }

      if (attempt < retry) {
        await sleep(Math.min(1000 * 2 ** attempt, 10000));
      }
    }
  }

  throw lastError;
}
