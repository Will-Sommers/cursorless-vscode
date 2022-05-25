(comment) @comment
(if) @ifStatement
(call) @functionCall
(method) @namedFunction
(method
  name: (_) @functionName.identifier) @functionName
(hash) @map

[
  (array)
  (string_array)
  (symbol_array)
] @list

(regex) @regex

(class) @class
(class
  name: (_) @className.identifier ) @className

(assignment
  left: (_) @name.identifier) @name
(operator_assignment
  left: (_) @name.identifier) @name
(class
  name: (_) @name.identifier) @name
(method
  name: (_) @name.identifier) @name
