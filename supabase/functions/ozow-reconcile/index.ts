import { ozowHandler } from '../_shared/ozow-handlers.ts';
import { ozowRuntime } from '../_shared/ozow-runtime.ts';
Deno.serve(ozowHandler('reconcile',ozowRuntime()));
