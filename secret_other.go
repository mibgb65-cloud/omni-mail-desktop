//go:build !windows

package main

func protectSecret(value string) (string, bool, error) {
	return value, false, nil
}

func unprotectSecret(value string, protected bool) (string, error) {
	return value, nil
}
