import { Location, Selection } from "vscode";
import { SyntaxNode } from "web-tree-sitter";
import { NoContainingScopeError } from "../../../errors";
import {
  getNodeMatcher,
  getQueryNodeMatcher
} from "../../../languages/getNodeMatcher";
import {
  ContainingScopeModifier,
  EveryScopeModifier,
  SimpleScopeType,
  SimpleScopeTypeType, Target
} from "../../../typings/target.types";
import {
  NodeMatcher,
  ProcessedTargetsContext,
  SelectionWithEditor,
  SelectionWithEditorWithContext
} from "../../../typings/Types";
import { selectionWithEditorFromRange } from "../../../util/selectionUtils";
import { ModifierStage } from "../../PipelineStages.types";
import ScopeTypeTarget from "../../targets/ScopeTypeTarget";
} from "../../../typings/targetDescriptor.types";

export interface SimpleContainingScopeModifier extends ContainingScopeModifier {
  scopeType: SimpleScopeType;
}

export interface SimpleEveryScopeModifier extends EveryScopeModifier {
  scopeType: SimpleScopeType;
}

export default class implements ModifierStage {
  constructor(
    private modifier: SimpleContainingScopeModifier | SimpleEveryScopeModifier
  ) {}

  run(context: ProcessedTargetsContext, target: Target): ScopeTypeTarget[] {
    const languageId = target.editor.document.languageId;
    const scopeType = this.modifier.scopeType.type;
    const queryNodeMatcher = getQueryNodeMatcher(languageId, scopeType);
    const scopeNodes = !queryNodeMatcher
      ? this.runLegacyNodeMatcher(languageId, scopeType, context, target)
      : this.runQueryBasedNodeMatcher(queryNodeMatcher, context, target);

    if (scopeNodes == null) {
      throw new NoContainingScopeError(this.modifier.scopeType.type);
    }

    return scopeNodes.map((scope) => {
      const {
        containingListDelimiter,
        leadingDelimiterRange,
        trailingDelimiterRange,
        removalRange,
      } = scope.context;

      if (
        removalRange != null &&
        (leadingDelimiterRange != null || trailingDelimiterRange != null)
      ) {
        throw Error(
          "Removal range is mutually exclusive with leading or trailing delimiter range"
        );
      }

      const { editor, selection: contentSelection } = scope.selection;

      return new ScopeTypeTarget({
        scopeTypeType: this.modifier.scopeType.type,
        editor,
        isReversed: target.isReversed,
        contentRange: contentSelection,
        removalRange: removalRange,
        delimiter: containingListDelimiter,
        leadingDelimiterRange,
        trailingDelimiterRange,
      });
    });
  }

  private runLegacyNodeMatcher(
    languageId: string,
    scopeTypeType: SimpleScopeTypeType,
    context: ProcessedTargetsContext,
    target: Target
  ) {
    const nodeMatcher = getNodeMatcher(
      languageId,
      scopeTypeType,
      this.modifier.type === "everyScope"
    );

    const node: SyntaxNode | null = context.getNodeAtLocation(
      new Location(target.editor.document.uri, target.contentRange)
    );

    return findNearestContainingAncestorNode(
      node,
      nodeMatcher,
      getSelectionWithEditor(target)
    );
  }

  private runQueryBasedNodeMatcher(
    queryNodeMatcher: NodeMatcher,
    context: ProcessedTargetsContext,
    target: Target
  ) {
    const selectionWithEditor = getSelectionWithEditor(target);

    const matchResult = queryNodeMatcher(
      selectionWithEditor,
      context.getTree(selectionWithEditor.editor.document),
      this.modifier.type === "everyScope"
    );

    return matchResult
      ? matchResult.map((match) => ({
          selection: selectionWithEditorFromRange(
            selectionWithEditor,
            match.selection.selection
          ),
          context: match.selection.context,
        }))
      : null;
  }
}

function getSelectionWithEditor(target: Target) {
  return {
    editor: target.editor,
    selection: new Selection(
      target.contentRange.start,
      target.contentRange.end
    ),
  };
}

function findNearestContainingAncestorNode(
  startNode: SyntaxNode,
  nodeMatcher: NodeMatcher,
  selection: SelectionWithEditor
): SelectionWithEditorWithContext[] | null {
  let node: SyntaxNode | null = startNode;
  while (node != null) {
    const matches = nodeMatcher(selection, node);
    if (matches != null) {
      return matches
        .map((match) => match.selection)
        .map((matchedSelection) => ({
          selection: selectionWithEditorFromRange(
            selection,
            matchedSelection.selection
          ),
          context: matchedSelection.context,
        }));
    }
    node = node.parent;
  }

  return null;
}
