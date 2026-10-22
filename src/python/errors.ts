import type { PyError } from './protocol'

/** Short plain-language explanations for the errors a beginner meets most. */
const HINTS: Record<string, string> = {
  NoInput: 'Не хватает ввода: программа вызвала input(), а строки в поле «Ввод» закончились.',
  SyntaxError: 'Синтаксическая ошибка: Python не понял запись. Проверь скобки, кавычки и двоеточия.',
  IndentationError: 'Ошибка отступа: тело после «:» должно быть сдвинуто на 4 пробела.',
  TabError: 'В отступах смешаны табуляция и пробелы.',
  NameError: 'Такого имени нет: переменная или функция не создана, или в имени опечатка.',
  UnboundLocalError: 'Переменная используется в функции раньше, чем ей присвоили значение.',
  TypeError: 'Действие не подходит для этого типа данных (например, сложить строку и число).',
  ValueError: 'Неподходящее значение: тип верный, но содержимое нет (например, int("abc")).',
  ZeroDivisionError: 'Деление на ноль.',
  IndexError: 'Индекс за пределами: в списке или строке нет элемента с таким номером.',
  KeyError: 'В словаре нет такого ключа.',
  AttributeError: 'У этого значения нет такого метода или свойства.',
  RecursionError: 'Слишком глубокая рекурсия: проверь базовый случай.',
  ModuleNotFoundError: 'Такого модуля нет.',
  ImportError: 'Не удалось импортировать.',
  OverflowError: 'Число получилось слишком большим.',
  InternalError: 'Внутренняя ошибка Python в браузере. Запусти ещё раз.',
}

export function describeError(error: PyError, code: string) {
  const where = error.line ? `Ошибка в строке ${error.line}` : 'Ошибка'
  const source = error.line ? code.split('\n')[error.line - 1]?.trim() : undefined
  const hint = HINTS[error.type]
  const technical = error.type === 'NoInput' ? 'EOFError' : `${error.type}: ${error.message}`
  return { where, source: source || undefined, hint, technical }
}
