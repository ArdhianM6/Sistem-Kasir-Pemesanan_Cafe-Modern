<?php
declare(strict_types=1);

namespace Cafe\Application\UseCases;

use Cafe\Application\Contracts\AuthRepository;

final class AuthenticateUser
{
    public function __construct(private AuthRepository $users) {}

    public function execute(string $login, string $password): ?array
    {
        $login = trim($login);
        if ($login === '' || $password === '') return null;

        $user = $this->users->findActiveUserByLogin($login);
        if (!$user || !password_verify($password, $user['password_hash'])) return null;

        return [
            'id' => (int) $user['id'],
            'username' => $user['username'],
            'name' => $user['full_name'],
            'role' => $user['role'],
        ];
    }
}
