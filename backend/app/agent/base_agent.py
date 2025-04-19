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
        memory: Optional[ConversationBufferMemory] = None,
        custom_endpoint: Optional[str] = None,
        custom_api_key: Optional[str] = None,
        custom_model_name: Optional[str] = None
    ):
        # Initialize the language model with configuration
        # Fix: Only use custom settings if they're non-empty strings
        llm_config = {
            "model_name": custom_model_name if custom_model_name and custom_model_name.strip() else (settings.MODEL_NAME if model_name == "gpt-4" else model_name),
            "temperature": temperature,
            "openai_api_base": custom_endpoint if custom_endpoint and custom_endpoint.strip() else settings.MODEL_ENDPOINT,
            "openai_api_key": custom_api_key if custom_api_key and custom_api_key.strip() else settings.OPENAI_API_KEY,
        }
        
        # Add Azure-specific configurations if using Azure and no custom endpoint is provided
        if settings.AZURE_API_VERSION and not (custom_endpoint and custom_endpoint.strip()):
            llm_config.update({
                "openai_api_type": "azure",
                "openai_api_version": settings.AZURE_API_VERSION,
                "deployment_name": settings.AZURE_DEPLOYMENT_NAME,
                "openai_api_base": f"https://{settings.AZURE_RESOURCE_NAME}.openai.azure.com",
            })
        
        self.llm = ChatOpenAI(**llm_config)
        
        # Store custom settings for reinitialization if needed
        self.custom_endpoint = custom_endpoint if custom_endpoint and custom_endpoint.strip() else None
        self.custom_api_key = custom_api_key if custom_api_key and custom_api_key.strip() else None
        self.custom_model_name = custom_model_name if custom_model_name and custom_model_name.strip() else None
        
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
    
    def update_llm_settings(self, custom_endpoint: Optional[str] = None, custom_api_key: Optional[str] = None, custom_model_name: Optional[str] = None):
        """Update the language model with new API settings"""
        # Only update if new settings are provided and they're not empty strings
        if (custom_endpoint and custom_endpoint.strip()) or \
           (custom_api_key and custom_api_key.strip()) or \
           (custom_model_name and custom_model_name.strip()):
            
            # Save new settings, only if they're non-empty
            self.custom_endpoint = custom_endpoint if custom_endpoint and custom_endpoint.strip() else self.custom_endpoint
            self.custom_api_key = custom_api_key if custom_api_key and custom_api_key.strip() else self.custom_api_key
            self.custom_model_name = custom_model_name if custom_model_name and custom_model_name.strip() else self.custom_model_name
            
            # Update the language model with new configuration
            llm_config = {
                "model_name": self.custom_model_name if self.custom_model_name and self.custom_model_name.strip() else self.llm.model_name,
                "temperature": self.llm.temperature,
                "openai_api_base": self.custom_endpoint if self.custom_endpoint and self.custom_endpoint.strip() else settings.MODEL_ENDPOINT,
                "openai_api_key": self.custom_api_key if self.custom_api_key and self.custom_api_key.strip() else settings.OPENAI_API_KEY,
            }
            
            # Add Azure-specific configurations if using Azure and no custom endpoint
            if settings.AZURE_API_VERSION and not (self.custom_endpoint and self.custom_endpoint.strip()):
                llm_config.update({
                    "openai_api_type": "azure",
                    "openai_api_version": settings.AZURE_API_VERSION,
                    "deployment_name": settings.AZURE_DEPLOYMENT_NAME,
                    "openai_api_base": f"https://{settings.AZURE_RESOURCE_NAME}.openai.azure.com",
                })
            
            # Create new language model with updated settings
            self.llm = ChatOpenAI(**llm_config)
    
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

    def cleanup(self):
        """Release resources associated with this agent"""
        # Clean up LLM resources
        if hasattr(self, 'llm'):
            if hasattr(self.llm, 'client'):
                if hasattr(self.llm.client, 'close'):
                    try:
                        self.llm.client.close()
                    except:
                        pass
        
        # Clear memory
        if hasattr(self, 'memory'):
            if hasattr(self.memory, 'clear'):
                try:
                    self.memory.clear()
                except:
                    pass 