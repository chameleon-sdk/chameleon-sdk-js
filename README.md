# Chameleon JavaScript SDK

SDK para interfaces JavaScript iniciarem e administrarem conexões de marketplaces. A aplicação integra apenas o pacote; callbacks, OAuth/LWA, tokens e assinatura dos marketplaces permanecem hospedados no Chameleon.

O browser precisa alcançar um **SDK Gateway** do Chameleon, mas ele não é uma API pública de integração: não usa Secret Key, não expõe operações de provider e só aceita Publishable Key, sessão Chameleon válida, RBAC de workspace e origem CORS permitida. Esse é o padrão de uma API de frontend hospedada, como nas plataformas de autenticação.

## Uso

```bash
npm install @chameleon/sdk
```

```js
import { createChameleonClient } from "@chameleon/sdk";

const chameleon = createChameleonClient({
  publishableKey: "pk_live_...",
  getSessionToken: () => app.chameleonSession.getToken(),
});

document.querySelector("#connect-amazon").addEventListener("click", async () => {
  await chameleon.connect({
    provider: "amazon",
    organizationId: currentWorkspace.id,
    returnUrl: "https://app.example.com/integrations",
  });
});
```

`connect()` chama o SDK Gateway do Chameleon e redireciona para o Hosted Connect. A chave publicável identifica o environment; a sessão Chameleon e as permissões de workspace são verificadas no servidor antes de uma tentativa ser criada.

## Operações de interface

```js
const result = chameleon.getConnectResult();
const connection = await chameleon.getConnection(result.connectionId);

if (connection.resources.some((resource) => !resource.selected)) {
  await chameleon.selectResources(connection.id, ["amazon:seller:marketplace:ATVPDKIKX0DER"]);
}

await chameleon.reconnect(connection.id); // abre Hosted Connect novamente
await chameleon.disconnect(connection.id);
```

Não passe `sk_...`, credenciais Amazon, tokens LWA ou refresh tokens para este SDK. Ele rejeita `secretKey` por projeto.

## Integração da plataforma

O Chameleon deve montar os endpoints internos em `/v1/frontend/*`, validar Publishable Key + sessão, aplicar `WorkspaceAuthorizer` e configurar CORS para as origens dos produtos permitidos. Esse contrato é implementado pelo `chameleon-sdk` principal em `createAmazonHostedApi`.

## Desenvolvimento

```bash
npm test
npm run check
```
