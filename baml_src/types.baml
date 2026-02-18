// Domain-only actions - NO UI gestures
// Protocol version 1.0

enum ActionType {
  SET_INPUT
  RUN_SIMULATION
  SHOW_DIFF
  INSERT_NODE
}

class SetInputAction {
  actionId string? @description("Optional - server normalizes with nanoid if missing/invalid")
  type "SET_INPUT"
  node string @description("The input node name (e.g., 'sw', 'btn1', 'dataIn')")
  value int @description("The value to set (0 or 1 for Switch/Button, 0-255 for Input)")
}

class RunSimulationAction {
  actionId string? @description("Optional - server normalizes with nanoid if missing/invalid")
  type "RUN_SIMULATION"
  cycles int @description("Number of clock cycles to run (max 100). Use for sequential circuits only.")
  stimuli map<string, int>? @description("Optional input stimuli: input name -> initial value")
}

class ShowDiffAction {
  actionId string? @description("Optional - server normalizes with nanoid if missing/invalid")
  type "SHOW_DIFF"
  originalCode string @description("The current DSL code to be modified")
  suggestedCode string @description("The suggested new DSL code")
  explanation string @description("Human-readable explanation of what changes and why")
}

class InsertNodeAction {
  actionId string? @description("Optional - server normalizes with nanoid if missing/invalid")
  type "INSERT_NODE"
  componentRef string @description("Reference to component type from library (e.g., 'Register', 'And')")
  suggestedLabel string? @description("Suggested instance label (e.g., 'reg1')")
  connectFrom string? @description("Optional: source port to connect from (e.g., 'xor1.out')")
  connectTo string? @description("Optional: target port to connect to (e.g., 'out')")
}
