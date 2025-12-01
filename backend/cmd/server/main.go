package main

import (
	"intervals-sync/internal/api"
	"intervals-sync/internal/store"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
)

func main() {
	// Read configuration from environment
	tursoURL := os.Getenv("TURSO_URL")
	tursoToken := os.Getenv("TURSO_AUTH_TOKEN")
	sqlitePath := os.Getenv("SQLITE_PATH")
	if sqlitePath == "" {
		sqlitePath = "./intervals.db"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Optional password for backend access
	syncPassword := os.Getenv("SYNC_PASSWORD")
	if syncPassword != "" {
		log.Println("Password authentication enabled")
	} else {
		log.Println("Warning: No SYNC_PASSWORD set - backend is open to anyone")
	}

	// Initialize store
	var storeConfig *store.Config
	if tursoURL != "" {
		storeConfig = &store.Config{
			TursoURL:       tursoURL,
			TursoAuthToken: tursoToken,
		}
		log.Println("Using Turso database:", tursoURL)
	} else {
		storeConfig = &store.Config{
			SQLitePath: sqlitePath,
		}
		log.Println("Using SQLite database:", sqlitePath)
	}

	s, err := store.NewStore(storeConfig)
	if err != nil {
		log.Fatalf("Failed to initialize store: %v", err)
	}
	defer s.Close()

	// Initialize rate limiter
	rl := api.NewRateLimiter()

	// Initialize handlers with optional password
	handler := api.NewHandler(s, rl, syncPassword)

	// Create router
	r := chi.NewRouter()

	// CORS middleware
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		ExposedHeaders:   []string{"*"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	// API routes
	r.Route("/api", func(r chi.Router) {
		r.Get("/health", handler.HealthCheck)

		r.Route("/auth", func(r chi.Router) {
			r.Post("/test", handler.TestConnection)
			r.Post("/init", handler.AuthInit)
			r.Post("/logout", handler.Logout)
		})

		r.Post("/sync", handler.Sync)
		r.Post("/profiles", handler.GetProfiles)

		r.Route("/workouts", func(r chi.Router) {
			r.Get("/{id}", handler.GetWorkout)
			r.Delete("/{id}", handler.DeleteWorkout)
		})

		r.Route("/completions", func(r chi.Router) {
			r.Delete("/{id}", handler.DeleteCompletion)
		})
	})

	// Health check for monitoring
	r.Get("/health", handler.HealthCheck)

	log.Printf("Starting server on port %s\n", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
