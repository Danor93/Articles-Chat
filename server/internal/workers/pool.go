package workers

import (
	"context"
	"log/slog"
	"time"

	"github.com/alitto/pond"
)

type PoolManager struct {
	ArticleProcessor *pond.WorkerPool
	GeneralPool      *pond.WorkerPool
}

type PoolConfig struct {
	ArticleWorkers int
	Workers        int
}

func NewPoolManager(config PoolConfig) *PoolManager {
	return &PoolManager{
		ArticleProcessor: pond.New(
			config.ArticleWorkers,
			config.ArticleWorkers*2,
			pond.MinWorkers(1),
			pond.IdleTimeout(30*time.Second),
		),
		GeneralPool: pond.New(
			config.Workers,
			config.Workers*2,
			pond.MinWorkers(1),
			pond.IdleTimeout(30*time.Second),
		),
	}
}

func (pm *PoolManager) SubmitArticleTask(task func()) {
	pm.ArticleProcessor.Submit(task)
}

func (pm *PoolManager) SubmitTask(task func()) {
	pm.GeneralPool.Submit(task)
}

func (pm *PoolManager) SubmitArticleTaskWithTimeout(ctx context.Context, task func(), timeout time.Duration) error {
	taskCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	taskChan := make(chan struct{}, 1)
	
	pm.ArticleProcessor.Submit(func() {
		defer func() {
			if r := recover(); r != nil {
				slog.Error("Article task panicked", "error", r)
			}
			taskChan <- struct{}{}
		}()
		task()
	})

	select {
	case <-taskChan:
		return nil
	case <-taskCtx.Done():
		return taskCtx.Err()
	}
}

func (pm *PoolManager) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"article_pool": map[string]interface{}{
			"running_workers":  pm.ArticleProcessor.RunningWorkers(),
			"idle_workers":     pm.ArticleProcessor.IdleWorkers(),
			"submitted_tasks":  pm.ArticleProcessor.SubmittedTasks(),
			"waiting_tasks":    pm.ArticleProcessor.WaitingTasks(),
			"successful_tasks": pm.ArticleProcessor.SuccessfulTasks(),
			"failed_tasks":     pm.ArticleProcessor.FailedTasks(),
		},
		"general_pool": map[string]interface{}{
			"running_workers":  pm.GeneralPool.RunningWorkers(),
			"idle_workers":     pm.GeneralPool.IdleWorkers(),
			"submitted_tasks":  pm.GeneralPool.SubmittedTasks(),
			"waiting_tasks":    pm.GeneralPool.WaitingTasks(),
			"successful_tasks": pm.GeneralPool.SuccessfulTasks(),
			"failed_tasks":     pm.GeneralPool.FailedTasks(),
		},
	}
}

func (pm *PoolManager) Shutdown() {
	slog.Info("Shutting down worker pools...")
	
	pm.ArticleProcessor.StopAndWait()
	slog.Info("Article processor pool stopped")
	
	pm.GeneralPool.StopAndWait()
	slog.Info("General pool stopped")
	
	slog.Info("All worker pools shut down successfully")
}