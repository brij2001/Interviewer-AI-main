package main

import (
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

func createLLMProxyHandler(targetURL string, validApiKey string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		startTime := time.Now()
		log.Printf("Received request: %s %s", r.Method, r.URL.Path)

		// API key authentication
		apiKey := r.Header.Get("X-API-Key")
		if apiKey != validApiKey {
			log.Printf("Authentication failed: Invalid API key")
			http.Error(w, "Unauthorizedg", http.StatusUnauthorized)
			return
		}

		// Create a new proxy request
		proxyPath := strings.TrimPrefix(r.URL.Path, "/api/llm")

		log.Printf("Proxying request to: %s", proxyPath)
		proxyURL := targetURL + proxyPath

		proxyReq, err := http.NewRequest(r.Method, proxyURL, r.Body)
		if err != nil {
			log.Printf("Error creating proxy request: %v", err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		// Copy headers from the original request
		for name, values := range r.Header {
			// Skip the API key header so it doesn't get forwarded to the LLM API
			if name != "X-API-Key" {
				for _, value := range values {
					proxyReq.Header.Add(name, value)
				}
			}
		}

		// Send the proxy request
		client := &http.Client{}
		resp, err := client.Do(proxyReq)
		if err != nil {
			log.Printf("Error in proxy request: %v", err)
			http.Error(w, "Bad Gateway", http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		// Copy the response headers
		for name, values := range resp.Header {
			for _, value := range values {
				w.Header().Add(name, value)
			}
		}

		// Set the status code
		w.WriteHeader(resp.StatusCode)

		// Copy the response body
		_, err = io.Copy(w, resp.Body)
		if err != nil {
			log.Printf("Error copying response body: %v", err)
			return
		}

		elapsed := time.Since(startTime)
		log.Printf("Request completed in %v with status %d", elapsed, resp.StatusCode)
	}
}
