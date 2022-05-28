import { createResponse } from 'create-response';
import { createAkamaiEdgeContext, createAkamaiProxyEdgeHandler } from '@uniformdev/context-edge-akamai';
import { ManifestV2 } from '@uniformdev/context';
/**
 * The Uniform manifest is available as a local resource.
 * This means if the manifest changes, you must rebuild
 * and deploy the EdgeWorker. 
 * 
 * You might want to deploy the manifest to the origin and 
 * have the EdgeWorker read the manifest from there. This 
 * will allow you to make deploy changes to the manifest 
 * without having to rebuild and deploy the EdgeWorker.
 */
import manifestJson from './manifest/current.json';
const manifest: ManifestV2 = <ManifestV2>manifestJson;

export async function responseProvider(request: EW.ResponseProviderRequest & EW.ReadsVariables) {
  try {
    /**
     * Since personalization instructions are going 
     * to run in the EdgeWorker, a context object is
     * needed. This basically provides state data to
     * the personalization process.
     */
    const context = createAkamaiEdgeContext({ request, manifest });

    /**
     * The proxy handler makes the request to the origin
     * and it executes the personalization instructions.
     */
    const handler = createAkamaiProxyEdgeHandler();

    /**
     * This runs the proxy handler, passing it the 
     * relevant context and other information so it
     * can execute the personalization instructions.
     */
    const { processed, response } = await handler({
      context,
      request,
      /**
       * You can set quirks from request objects that
       * Akamai makes available to your EdgeWorker at
       * runtime.
       */
      quirks: {
        userLocation: ["city", "country"],
        device: ["isMobile"],
      }
    });

    /**
     * Add headers to the response. These are not required but
     * they can help with debugging. These headers provide
     * information about the original request and the result
     * of the EdgeWorker running.
     */
    const headers = response.headers;
    headers['x-rp-request-scheme'] = [request.scheme];
    headers['x-rp-request-host'] = [request.host];
    headers['x-rp-request-url'] = [request.url];
    headers['x-rp-processed'] = [String(processed)];
    headers['x-rp-status'] = [String(response.status)];
    headers['x-rp-timestamp'] = [String(new Date().getTime())];
    
    /**
     * Return a new response based on the response
     * from the proxy handler.
     */
    return createResponse(response.status, response.headers, response.body);
  } catch (e) {
    /**
     * If an error happens, return details in the response.
     */
    return createResponse(JSON.stringify(e, Object.getOwnPropertyNames(e)));
  }
}
