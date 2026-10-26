<?php
declare(strict_types=1);

namespace Cafe\Application\Contracts;

interface AuthRepository
{
    public function findActiveUserByLogin(string $login): ?array;
}
