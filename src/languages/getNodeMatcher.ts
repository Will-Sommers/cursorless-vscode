import { intersection } from "lodash";
import { SyntaxNode, Tree } from "web-tree-sitter";
import { UnsupportedLanguageError } from "../errors";
import { SimpleScopeTypeType } from "../typings/target.types";
import {
  NodeMatcher,
  NodeMatcherValue,
  SelectionWithEditor,
} from "../typings/Types";
import { notSupported } from "../util/nodeMatchers";
import { selectionWithEditorFromRange } from "../util/selectionUtils";
import clojure from "./clojure";
import { SupportedLanguageId } from "./constants";
import cpp from "./cpp";
import csharp from "./csharp";
import go from "./go";
import { patternMatchers as html } from "./html";
import java from "./java";
import { patternMatchers as json } from "./json";
import markdown from "./markdown";
import php from "./php";
import python from "./python";
import queryBasedSpecification from "./queryBasedSpecification";
import { patternMatchers as ruby } from "./ruby";
import scala from "./scala";
import { patternMatchers as scss } from "./scss";
import { patternMatchers as typescript } from "./typescript";

export function getNodeMatcher(
  languageId: string,
  scopeTypeType: SimpleScopeTypeType,
  includeSiblings: boolean
): NodeMatcher {
  const matchers = languageMatchers[languageId as SupportedLanguageId];

  if (matchers == null) {
    throw new UnsupportedLanguageError(languageId);
  }

  const matcher = matchers[scopeTypeType];

  if (matcher == null) {
    return notSupported;
  }

  if (includeSiblings) {
    return matcherIncludeSiblings(matcher);
  }

  return matcher;
}

export function getQueryNodeMatcher(
  languageId: string,
  scopeTypeType: SimpleScopeTypeType
): NodeMatcher | null {
  const matchers = queryBasedMatchers[languageId as SupportedLanguageId];

  if (matchers == null) {
    // Note: When all nodes are matched using this method, return notSupported.
    return null;
  }

  return matchers[scopeTypeType];
}

const languageMatchers: Record<
  SupportedLanguageId,
  Record<SimpleScopeTypeType, NodeMatcher>
> = {
  c: cpp,
  cpp,
  css: scss,
  csharp,
  clojure,
  go,
  html,
  java,
  javascript: typescript,
  javascriptreact: typescript,
  json,
  jsonc: json,
  markdown,
  php,
  python,
  ruby,
  scala,
  scss,
  typescript,
  typescriptreact: typescript,
  xml: html,
};

const queryBasedMatchers: Partial<
  Record<SupportedLanguageId, Record<SimpleScopeTypeType, NodeMatcher>>
> = {
  ruby: queryBasedSpecification("ruby"),
};

for (const languageId in queryBasedMatchers) {
  let queryBasedMatcher = queryBasedMatchers[languageId as SupportedLanguageId];
  if (queryBasedMatcher) {
    ensureUniqueMatchers(
      languageMatchers[languageId as SupportedLanguageId],
      queryBasedMatcher,
      languageId
    );
  }
}

function ensureUniqueMatchers(
  regexMatcher: Record<SimpleScopeTypeType, NodeMatcher>,
  queryBasedMatchers:
    | Partial<Record<SimpleScopeTypeType, NodeMatcher>>
    | undefined,
  languageName: string
) {
  const duplicates = intersection(
    Object.keys(regexMatcher),
    Object.keys(queryBasedMatchers)
  );
  if (duplicates.length > 0) {
    throw new Error(
      `ScopeTypes: [${duplicates.join(
        ", "
      )}] for ${languageName} defined via both Regex and Query code paths. Please remove duplicates`
    );
  }
}

function matcherIncludeSiblings(matcher: NodeMatcher): NodeMatcher {
  return (
    selection: SelectionWithEditor,
    treeSitterHook: SyntaxNode | Tree
  ): NodeMatcherValue[] | null => {
    let node = treeSitterHook as SyntaxNode;
    let matches = matcher(selection, node);
    if (matches == null) {
      return null;
    }
    matches = matches.flatMap((match) =>
      iterateNearestIterableAncestor(
        match.node,
        selectionWithEditorFromRange(selection, match.selection.selection),
        matcher
      )
    ) as NodeMatcherValue[];
    if (matches.length > 0) {
      return matches;
    }
    return null;
  };
}

function iterateNearestIterableAncestor(
  node: SyntaxNode,
  selection: SelectionWithEditor,
  nodeMatcher: NodeMatcher
) {
  let parent: SyntaxNode | null = node.parent;
  while (parent != null) {
    const matches = parent!.namedChildren
      .flatMap((sibling) => nodeMatcher(selection, sibling))
      .filter((match) => match != null) as NodeMatcherValue[];
    if (matches.length > 0) {
      return matches;
    }
    parent = parent.parent;
  }
  return [];
}
