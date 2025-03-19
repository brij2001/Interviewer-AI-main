package main

import (
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not found")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	apiKey := os.Getenv("API_KEY")
	if apiKey == "" {
		log.Fatal("API_KEY environment variable is required")
	}

	llmApiUrl := os.Getenv("LLM_API_URL")
	if llmApiUrl == "" {
		log.Fatal("LLM_API_URL environment variable is required")
	}

	// Setup routes
	http.HandleFunc("/api/llm/", createLLMProxyHandler(llmApiUrl, apiKey))

	// Start the server
	log.Printf("Middleware server starting on port %s...\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
