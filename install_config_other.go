//go:build !windows

package main

func installedDataDir() (string, bool) {
	return "", false
}
