/**
 * JSONC parser utility for handling JSON with comments
 *
 * JSONC (JSON with Comments) is a superset of JSON that allows single-line
 * and multi-line comments, which is useful for configuration files.
 */

/**
 * Remove JSONC comments from a string
 */
export function stripComments(jsonString: string): string {
  const comments = [
    { pattern: /\/\/.*$/gm, replacement: "" },
    { pattern: /\/\*[\s\S]*?\*\//g, replacement: "" },
  ];

  let result = jsonString;

  for (const { pattern, replacement } of comments) {
    result = result.replace(pattern, replacement);
  }

  return result;
}

/**
 * Parse JSONC string into a JavaScript object
 */
export function parseJSONC(jsonString: string): unknown {
  const stripped = stripComments(jsonString);
  return JSON.parse(stripped);
}
