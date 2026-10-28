import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';

export function configureProxy() {
    if (
        process.env.HTTP_PROXY ||
        process.env.HTTPS_PROXY ||
        process.env.http_proxy ||
        process.env.https_proxy
    )
        setGlobalDispatcher(new EnvHttpProxyAgent());
}
