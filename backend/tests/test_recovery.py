import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.schemas.user import UserProfileResponse
from app.services import ai_service


class LegacyProfileTests(unittest.TestCase):
    def profile(self, preferences):
        return SimpleNamespace(id='profile', user_id='user', name='Saved Profile', age=30,
                               gender='Male', blood_type='O+', height=170, weight=70,
                               organ_preferences=preferences)

    def test_null_preferences_do_not_hide_existing_profile(self):
        saved = self.profile(None)
        response = UserProfileResponse.model_validate(saved)
        self.assertEqual(response.organ_preferences, {})
        self.assertEqual(response.name, 'Saved Profile')
        self.assertIsNone(saved.organ_preferences)

    def test_existing_preferences_are_preserved(self):
        response = UserProfileResponse.model_validate(self.profile({'kidney': True}))
        self.assertEqual(response.organ_preferences, {'kidney': True})


class ChatModelTests(unittest.IsolatedAsyncioTestCase):
    async def choose(self, configured, model_ids):
        client = SimpleNamespace(models=SimpleNamespace(list=AsyncMock(return_value=
            SimpleNamespace(data=[SimpleNamespace(id=model) for model in model_ids]))))
        with patch.object(ai_service, '_dynamic_model', None), \
             patch.object(ai_service.settings, 'GROQ_MODEL', configured):
            return await ai_service._get_best_model(client)

    async def test_speech_model_is_not_selected_when_configured_model_is_retired(self):
        chosen = await self.choose('retired-model', ['canopylabs/orpheus-v1-english', 'openai/gpt-oss-120b'])
        self.assertEqual(chosen, 'openai/gpt-oss-120b')

    async def test_available_configured_model_is_respected(self):
        chosen = await self.choose('openai/gpt-oss-20b', ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'])
        self.assertEqual(chosen, 'openai/gpt-oss-20b')

    async def test_audio_only_catalogue_does_not_select_audio_model(self):
        chosen = await self.choose('openai/gpt-oss-120b', ['whisper-large-v3'])
        self.assertEqual(chosen, 'openai/gpt-oss-120b')
