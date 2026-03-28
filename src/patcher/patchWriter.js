import fs from 'fs';
import path from 'path';
import * as recast from 'recast';

// The set of SDK functions we know how to patch.
const HEAL_FUNCTION_NAMES = new Set(['healClick', 'healFill', 'healNavigate']);

export function patchTestFile(filePath, oldSelector, newSelector) {
  const absPath = path.resolve(filePath);

  if (!fs.existsSync(absPath)) {
    console.error(`  ⚠️  Patch target not found: ${absPath}`);
    return { patched: false, file: absPath, replacements: 0 };
  }

  try {
    const code = fs.readFileSync(absPath, 'utf-8');
    // The default parser (esprima) should handle modern JS.
    const ast = recast.parse(code);

    let patched = false;
    let replacements = 0;

    recast.visit(ast, {
      visitCallExpression(nodePath) {
        const { node } = nodePath;
        // Check if it's a call to one of our heal functions (e.g., healClick).
        if (
          node.callee.type === 'Identifier' &&
          HEAL_FUNCTION_NAMES.has(node.callee.name)
        ) {
          // The selector is expected to be the second argument.
          if (node.arguments.length > 1) {
            const selectorNode = node.arguments[1];
            if (
              selectorNode.type === 'Literal' &&
              typeof selectorNode.value === 'string' &&
              selectorNode.value === oldSelector
            ) {
              // Found it! Replace the value of the selector literal.
              selectorNode.value = newSelector;
              patched = true;
              replacements++;
              // Stop traversal after the first match to avoid unintended replacements.
              // The runner handles one failure at a time.
              return false;
            }
          }
        }
        this.traverse(nodePath);
      },
    });

    if (patched) {
      // Recast preserves original formatting, but we can enforce a style.
      const output = recast.print(ast, { quote: 'single', tabWidth: 2 });
      fs.writeFileSync(absPath, output.code, 'utf-8');
      console.log(`  ✏️  patchWriter (AST) rewrote: "${oldSelector}" → "${newSelector}"`);
    }

    return { patched, file: absPath, replacements };

  } catch (error) {
    console.error(`  ❌  AST-based patch failed for ${absPath}:`, error);
    // Fallback to original regex method could be an option, but for now, just fail.
    return { patched: false, file: absPath, error: error.message, replacements: 0 };
  }
}
