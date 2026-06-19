/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as apiKeys from "../apiKeys.js";
import type * as auth from "../auth.js";
import type * as authors from "../authors.js";
import type * as categories from "../categories.js";
import type * as dashboard from "../dashboard.js";
import type * as editorDrafts from "../editorDrafts.js";
import type * as editorPreferences from "../editorPreferences.js";
import type * as http from "../http.js";
import type * as lib_workspace from "../lib/workspace.js";
import type * as media from "../media.js";
import type * as members from "../members.js";
import type * as posts from "../posts.js";
import type * as publicApi from "../publicApi.js";
import type * as tags from "../tags.js";
import type * as users from "../users.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  apiKeys: typeof apiKeys;
  auth: typeof auth;
  authors: typeof authors;
  categories: typeof categories;
  dashboard: typeof dashboard;
  editorDrafts: typeof editorDrafts;
  editorPreferences: typeof editorPreferences;
  http: typeof http;
  "lib/workspace": typeof lib_workspace;
  media: typeof media;
  members: typeof members;
  posts: typeof posts;
  publicApi: typeof publicApi;
  tags: typeof tags;
  users: typeof users;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
