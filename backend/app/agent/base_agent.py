from langchain.chat_models import ChatOpenAI
from langchain.chains import LLMChain
from langchain.memory import ConversationBufferMemory
from typing import Dict, Any, Optional

from ..core.config import settings

class BaseAgent:
    """Base class for all agents in the interview system."""
    
    def __init__(
        self,
        model_name: str = "gpt-4",
        temperature: float = 0.7,
        memory: Optional[ConversationBufferMemory] = None
    ):
        # Initialize the language model with configuration
        llm_config = {
            "model_name": settings.MODEL_NAME if model_name == "gpt-4" else model_name,
            "temperature": temperature,
            "openai_api_base": settings.MODEL_ENDPOINT,
            "openai_api_key": settings.OPENAI_API_KEY,
        }
        
        # Add Azure-specific configurations if using Azure
        if settings.AZURE_API_VERSION:
            llm_config.update({
                "openai_api_type": "azure",
                "openai_api_version": settings.AZURE_API_VERSION,
                "deployment_name": settings.AZURE_DEPLOYMENT_NAME,
                "openai_api_base": f"https://{settings.AZURE_RESOURCE_NAME}.openai.azure.com",
            })
        
        self.llm = ChatOpenAI(**llm_config)
        
        # Initialize conversation memory if not provided
        if memory:
            self.memory = memory
        else:
            self.memory = ConversationBufferMemory(
                memory_key="chat_history",
                return_messages=True,
                input_key="human",
                output_key="text"
            )
        
    def create_chain(self, prompt_template, **kwargs):
        """Create a LangChain chain with the given prompt template and optional kwargs."""
        return LLMChain(
            llm=self.llm,
            prompt=prompt_template,
            memory=self.memory,
            verbose=kwargs.get("verbose", True)
        )
    
    def add_to_memory(self, human_input: str, ai_output: str):
        """Add context to the agent's memory."""
        self.memory.save_context(
            {"human": human_input},
            {"text": ai_output}
        ) 