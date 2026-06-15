import { intro, isCancel, note, outro, text } from '@clack/prompts';
import {
  ALLOWED_EMAILS_PLACEHOLDER,
  allowedEmailsToRegex,
  validateAllowedEmailsInput,
} from './cli/src/lib/allowed-emails.ts';

intro('Allowed-emails prompt UX test');

const answer = await text({
  message: 'Emails allowed to sign in (comma-separated, *@domain for a whole workspace)',
  placeholder: `${ALLOWED_EMAILS_PLACEHOLDER} — leave empty to allow any`,
  validate: validateAllowedEmailsInput,
});

if (isCancel(answer)) {
  outro('Cancelled.');
  process.exit(0);
}

const input = answer ?? '';
const regex = allowedEmailsToRegex(input);
note(JSON.stringify(input), 'You entered');
note(regex ?? '(none — any email allowed)', 'Compiles to BRAIN_ALLOWED_EMAILS_REGEX');
outro('Done.');
