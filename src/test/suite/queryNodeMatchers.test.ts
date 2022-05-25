import * as assert from "assert";
import { openNewEditor } from "../openNewEditor";
import { defaultMatcher } from "../../util/queryNodeMatchers";
import { getParseTreeApi } from "../../util/getExtensionApi";
import { selectionWithEditorFromPositions } from "../../util/selectionUtils";
import { NodeMatcher, SelectionWithEditor } from "../../typings/Types";
import { SyntaxNode } from "web-tree-sitter";
import { Position } from "vscode";

suite("queryNodeMatcher", async () => {
  suite("happy path", async () => {
    const matcher = defaultMatcher("comment", false, `(comment) @comment`);
    const nodeType = "comment";

    test("match single", async () => {
      const code = "# hello world";

      const { selection, node } = await getNodeAndEditor(code);
      assertMatch(matcher, node, nodeType, selection, 1);
    });

    test("match multiple by parent", async () => {
      const code = `# hello world
variable_def = "yep"
# hello world
# hello world`;
      const { selection, node } = await getNodeAndEditor(code);
      assertMatch(matcher, node, nodeType, selection, 3, {
        includeSiblings: true,
      });
    });
  });

  suite("expands range", async () => {
    const matcher = defaultMatcher("comment", false, `(comment) @comment`);
    const nodeType = "comment";
    const cursorPositions = {
      start: new Position(0, 0),
      end: new Position(1, 2),
    };

    test("matches with selection across two node the same type", async () => {
      const code = `# hello
# world`;
      const { selection, node } = await getNodeAndEditor(code, cursorPositions);
      const matches = assertMatch(matcher, node, nodeType, selection, 1);
      assert.equal(matches![0].selection.selection.isSingleLine, false);
    });

    test("no match with selection across two node the different type", async () => {
      const code = `# hello
hello_world()`;
      const { selection, node } = await getNodeAndEditor(code, cursorPositions);
      assertMatch(matcher, node, nodeType, selection, 0);
    });
  });

  suite("non-matches due to positions", async () => {
    const matcher = defaultMatcher(
      "functionCall",
      false,
      `(call) @functionCall`
    );

    // Use a node type is used that does not take up the entire line following the it.
    const code = " hello_world()       ";
    const nonMatchPositions = [
      {
        start: new Position(0, 0),
        end: new Position(0, 0),
        message: "Empty selection before the scope",
      },
      {
        start: new Position(0, code.length - 1),
        end: new Position(0, code.length - 1),
        message: "Empty selection after the scope",
      },
      {
        start: new Position(0, 0),
        end: new Position(0, 1),
        message: "Non-empty selection before the scope",
      },
      {
        start: new Position(0, 0),
        end: new Position(0, 1),
        message: "Non-empty selection abutting scope",
      },
      {
        start: new Position(0, code.length - 2),
        end: new Position(0, code.length - 1),
        message: "Non-empty selection after the scope",
      },
      {
        start: new Position(0, 0),
        end: new Position(0, 5),
        message: "Non-empty selection starting before and ending within scope",
      },
      {
        start: new Position(0, 5),
        end: new Position(0, code.length - 1),
        message:
          "Non-empty selection starting within scope and ending outside of scope",
      },
    ];
    for (const position of nonMatchPositions) {
      test(`empty selection in whitespace before scope does not match: ${position.message}`, async () => {
        const nodeType = "comment";
        const { selection, node } = await getNodeAndEditor(code, position);
        assertMatch(matcher, node, nodeType, selection, 0);
      });
    }
  });

  test("match multiple by searchScope throws error", async () => {
    const code = "# hello world";
    const matcher = defaultMatcher("comment", true, `(comment) @comment`);
    const { selection, node } = await getNodeAndEditor(code);
    assert.throws(() => {
      matcher(selection, node, true);
    });
  });
});

const getNodeAndEditor = async (
  code: string,
  cursorPositions: { start: Position; end: Position } = {
    start: new Position(0, 0),
    end: new Position(0, 0),
  }
): Promise<{ selection: SelectionWithEditor; node: SyntaxNode }> => {
  const editor = await openNewEditor(code, "ruby");
  const { getTree } = await getParseTreeApi();
  const tree = getTree(editor.document);

  const selectionWithEditor = selectionWithEditorFromPositions(
    { selection: editor.selection, editor },
    cursorPositions.start,
    cursorPositions.end
  );

  return {
    selection: selectionWithEditor,
    node: tree.rootNode,
  };
};

const assertMatch = (
  matcher: NodeMatcher,
  node: SyntaxNode,
  nodeType: string,
  selectionWithEditor: SelectionWithEditor,
  expectedMatches: number,
  options: { includeSiblings?: boolean } = { includeSiblings: false }
) => {
  const matches = matcher(selectionWithEditor, node, options?.includeSiblings);
  if (expectedMatches === 0) {
    assert.equal(matches, null);
  } else {
    assert.equal(expectedMatches, matches!.length);
    for (const match of matches!) {
      assert.equal(nodeType, match.node.type);
    }
  }
  return matches;
};
