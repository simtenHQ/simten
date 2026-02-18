// BAML Client Configuration

// OpenRouter - OpenAI-compatible API for accessing various LLMs
client<llm> OpenRouter {
  provider openai
  options {
    model "anthropic/claude-sonnet-4.6"
    api_key env.OPENROUTER_API_KEY
    base_url "https://openrouter.ai/api/v1"
  }
}

// Anthropic direct (alternative)
client<llm> Anthropic {
  provider anthropic
  options {
    model "claude-sonnet-4-20250514"
    api_key env.ANTHROPIC_API_KEY
  }
}
